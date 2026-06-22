import { useState } from 'react';
import { Alert, Button, DatePicker, Form, Input, InputNumber, Modal, Select, Space, Switch, Table, Tabs, Tag, message } from 'antd';
import dayjs from 'dayjs';
import { Check, CircleDollarSign, Download, Edit3, LockKeyhole, Printer, Search, X } from 'lucide-react';
import {
  CashClosure,
  Debtor,
  PaymentMethod,
  useCloseCashRegisterMutation,
  useCreatePaymentMutation,
  useGetDebtorsQuery,
  useGetPaymentsDashboardQuery,
  useReviewCashClosureMutation,
  useGetFinancialReportQuery,
  Payment,
  PaymentHistoryItem,
  Student,
  useGetStudentsQuery,
  useGetStudentFinanceQuery,
  useGetPaymentsHistoryQuery,
  useGetBrandingSettingsQuery,
  useReversePaymentMutation,
  useUpdatePaymentMutation,
} from '../../services/api';
import PaymentMethodSelector from '../../components/PaymentMethodSelector';
import BrandIdentity from '../../components/BrandIdentity';
import { getCourseBrand } from '../../config/branding';
import { API_BASE_URL } from '../../config/env';
import { useAuth } from '../../auth/AuthContext';

type MultiMonthPaymentFormValues = {
  amount: number;
  note?: string;
};

type StudentPaymentFormValues = {
  amount: number;
  method: PaymentMethod;
  isAdvance?: boolean;
  note?: string;
};

type PaymentReceipt = {
  payment: Payment;
  studentName: string;
  subject?: string;
};

const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: 'Naqd',
  bank_transfer: "Bank o'tkazma",
  click: 'Click',
};

const paymentMethodColors: Record<PaymentMethod, string> = {
  cash: '#e83f63',
  bank_transfer: '#20c997',
  click: '#f59e0b',
};

function formatMoney(value?: number) {
  return `${Number(value || 0).toLocaleString('uz-UZ')} so'm`;
}

function PaymentMethodChart({
  title,
  total,
  totals,
}: {
  title: string;
  total?: number;
  totals?: Partial<Record<PaymentMethod, number>>;
}) {
  const entries = (Object.entries(totals || {}) as [PaymentMethod, number][])
    .filter(([, amount]) => Number(amount) > 0)
    .sort(([, firstAmount], [, secondAmount]) => secondAmount - firstAmount);
  const totalAmount = Number(total || 0);
  let currentPercentage = 0;
  const gradientParts = entries.map(([method, amount]) => {
    const percentage = totalAmount > 0 ? (amount / totalAmount) * 100 : 0;
    const start = currentPercentage;
    currentPercentage += percentage;
    return `${paymentMethodColors[method]} ${start}% ${currentPercentage}%`;
  });

  return (
    <div className="payment-method-chart-card">
      <div className="payment-method-chart-heading">
        <span>{title}</span>
        <strong>{formatMoney(totalAmount)}</strong>
      </div>
      <div className="payment-method-chart-content">
        <div
          className={`payment-method-donut ${entries.length ? '' : 'is-empty'}`}
          style={entries.length ? { background: `conic-gradient(${gradientParts.join(', ')})` } : undefined}
          aria-label={`${title} to'lov usullari diagrammasi`}
        >
          <div>
            <strong>{entries.length}</strong>
            <span>usul</span>
          </div>
        </div>
        <div className="payment-method-chart-legend">
          {entries.length ? (
            entries.map(([method, amount]) => {
              const percentage = totalAmount > 0 ? (amount / totalAmount) * 100 : 0;

              return (
                <div key={method} className="payment-method-chart-row">
                  <i style={{ background: paymentMethodColors[method] }} />
                  <span>{paymentMethodLabels[method]}</span>
                  <strong>{percentage.toFixed(1)}%</strong>
                  <small>{formatMoney(amount)}</small>
                </div>
              );
            })
          ) : (
            <span className="muted-text">To'lov mavjud emas</span>
          )}
        </div>
      </div>
    </div>
  );
}

function MethodTotals({ totals }: { totals?: Partial<Record<PaymentMethod, number>> }) {
  const entries = Object.entries(totals || {}).filter(([, value]) => Number(value) > 0) as [PaymentMethod, number][];

  if (!entries.length) return <span className="muted-text">To'lov yo'q</span>;

  return (
    <Space wrap>
      {entries.map(([method, amount]) => (
        <Tag key={method} color="blue">
          {paymentMethodLabels[method]}: {formatMoney(amount)}
        </Tag>
      ))}
    </Space>
  );
}

function PhoneCell({ debtor }: { debtor: Debtor }) {
  return (
    <div className="stacked-cell">
      <span>{debtor.phone}</span>
      <small>{debtor.secondaryPhone || '-'}</small>
    </div>
  );
}

export default function PaymentsPage() {
  const { user } = useAuth();
  const [multiMonthPaymentForm] = Form.useForm<MultiMonthPaymentFormValues>();
  const [studentPaymentForm] = Form.useForm<StudentPaymentFormValues>();
  const [selectedDebtor, setSelectedDebtor] = useState<Debtor | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('cash');
  const [reportRange, setReportRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs().startOf('month'), dayjs()]);
  const [reportPaymentPage, setReportPaymentPage] = useState(1);
  const [reportPaymentMethod, setReportPaymentMethod] = useState<PaymentMethod | undefined>();
  const [reportPaymentSearch, setReportPaymentSearch] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);
  const enteredPaymentAmount = Form.useWatch('amount', multiMonthPaymentForm) || 0;
  const { data, isError, isFetching } = useGetPaymentsDashboardQuery();
  const { data: debtorsResponse, isFetching: isDebtorsFetching } = useGetDebtorsQuery();
  const [closeCashRegister, { isLoading: isClosing }] = useCloseCashRegisterMutation();
  const [createPayment, { isLoading: isPaymentSaving }] = useCreatePaymentMutation();
  const [reviewCashClosure, { isLoading: isReviewing }] = useReviewCashClosureMutation();
  const reportParams = { dateFrom: reportRange[0].format('YYYY-MM-DD'), dateTo: reportRange[1].format('YYYY-MM-DD') };
  const { data: report, isFetching: isReportFetching } = useGetFinancialReportQuery(reportParams);
  const { data: studentsResponse, isFetching: isStudentsFetching } = useGetStudentsQuery({ search: studentSearch.trim() || undefined, limit: 20, view: 'current' });
  const { data: selectedFinance, isFetching: isSelectedFinanceFetching } = useGetStudentFinanceQuery(selectedStudent?.id || '', { skip: !selectedStudent });
  const { data: paymentHistory, isFetching: isHistoryFetching } = useGetPaymentsHistoryQuery({ page: 1, limit: 100 });
  const { data: branding } = useGetBrandingSettingsQuery();
  const { data: reportPayments, isFetching: isReportPaymentsFetching } = useGetPaymentsHistoryQuery({
    ...reportParams,
    page: reportPaymentPage,
    limit: 20,
    method: reportPaymentMethod,
    search: reportPaymentSearch.trim() || undefined,
    status: 'active',
  });
  const [reversePayment] = useReversePaymentMutation();
  const [updatePayment] = useUpdatePaymentMutation();

  async function exportReport() {
    try {
      const response = await fetch(`${API_BASE_URL}/reports/finance/export?dateFrom=${reportParams.dateFrom}&dateTo=${reportParams.dateTo}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('sab_auth_token') || ''}` },
      });
      if (!response.ok) throw new Error('Eksportni yuklab bo‘lmadi');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `moliyaviy-hisobot-${reportParams.dateFrom}-${reportParams.dateTo}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Eksportda xatolik');
    }
  }

  async function submitStudentPayment(values: StudentPaymentFormValues) {
    if (!selectedStudent) return;
    try {
      const payment = await createPayment({ studentId: selectedStudent.id, body: { ...values, note: values.note?.trim() || '' } }).unwrap();
      setReceipt({ payment, studentName: selectedStudent.fullName, subject: selectedStudent.group?.subject });
      studentPaymentForm.resetFields();
      studentPaymentForm.setFieldsValue({ method: 'cash', isAdvance: false });
      message.success(values.isAdvance ? 'Oldindan to‘lov saqlandi' : 'To‘lov saqlandi');
    } catch (error) {
      const apiError = error as { data?: { message?: string } };
      message.error(apiError.data?.message || 'To‘lovni saqlab bo‘lmadi');
    }
  }

  function editPayment(record: Payment) {
    if (!selectedStudent) return;
    let amount = record.amount;
    let method = record.method;
    let note = record.note;
    Modal.confirm({
      title: 'To‘lovni tahrirlash',
      content: <Space direction="vertical" className="full-width"><InputNumber className="full-width" min={1} defaultValue={amount} onChange={(value) => { amount = Number(value) || 0; }} /><PaymentMethodSelector value={method} onChange={(value) => { method = value; }} /><Input defaultValue={note} placeholder="Izoh" onChange={(event) => { note = event.target.value; }} /></Space>,
      okText: 'Saqlash', cancelText: 'Yopish',
      onOk: () => updatePayment({ paymentId: record.id, studentId: selectedStudent.id, body: { amount, method, note } }).unwrap(),
    });
  }

  function cancelPayment(record: Payment) {
    if (!selectedStudent) return;
    let reason = '';
    Modal.confirm({
      title: record.cashStatus === 'approved' ? 'To‘lovni qaytarish' : 'To‘lovni bekor qilish',
      content: <Input placeholder="Sababni kiriting" onChange={(event) => { reason = event.target.value; }} />,
      okText: 'Tasdiqlash', cancelText: 'Yopish',
      onOk: async () => {
        if (!reason.trim()) throw new Error('Sabab kiritilishi kerak');
        await reversePayment({ paymentId: record.id, studentId: selectedStudent.id, reason }).unwrap();
      },
    });
  }

  function handleCloseCashRegister() {
    Modal.confirm({
      title: 'Kassani yopish',
      content: "Yopilmagan barcha to'lovlar bitta kassa yopilishiga biriktiriladi va owner tasdig'iga yuboriladi.",
      okText: 'Yopish',
      cancelText: 'Bekor qilish',
      okButtonProps: { loading: isClosing },
      async onOk() {
        try {
          await closeCashRegister().unwrap();
          message.success("Kassa owner tasdig'iga yuborildi");
        } catch (error) {
          const apiError = error as { data?: { message?: string } };
          message.error(apiError.data?.message || 'Kassani yopib bo‘lmadi');
        }
      },
    });
  }

  async function reviewClosure(closure: CashClosure, status: 'approved' | 'rejected') {
    try {
      await reviewCashClosure({ closureId: closure.id, status }).unwrap();
      message.success(status === 'approved' ? 'Kassa tasdiqlandi' : 'Kassa bekor qilindi');
    } catch (error) {
      const apiError = error as { data?: { message?: string } };
      message.error(apiError.data?.message || 'Amal bajarilmadi');
    }
  }

  function openDebtorPaymentModal(debtor: Debtor) {
    setSelectedDebtor(debtor);
    setSelectedPaymentMethod('cash');
    multiMonthPaymentForm.setFieldsValue({ amount: debtor.totalDebt, note: '' });
  }

  function closeDebtorPaymentModal() {
    setSelectedDebtor(null);
    multiMonthPaymentForm.resetFields();
  }

  async function payMultipleMonths(values: MultiMonthPaymentFormValues) {
    if (!selectedDebtor) return;

    try {
      const payment = await createPayment({
        studentId: selectedDebtor.studentId,
        body: {
          amount: values.amount,
          method: selectedPaymentMethod,
          note: values.note?.trim() || "Bir nechta oy uchun to'lov",
        },
      }).unwrap();
      setReceipt({ payment, studentName: selectedDebtor.fullName, subject: selectedDebtor.subject });
      message.success("To'lov eng eski qarzlardan boshlab taqsimlandi");
      closeDebtorPaymentModal();
    } catch (error) {
      const apiError = error as { data?: { message?: string } };
      message.error(apiError.data?.message || "To'lovni saqlab bo'lmadi");
    }
  }

  async function payDebtMonth(month: Debtor['months'][number]) {
    if (!selectedDebtor) return;

    try {
      const payment = await createPayment({
        studentId: selectedDebtor.studentId,
        body: {
          amount: month.debtAmount,
          method: selectedPaymentMethod,
          targetMonth: month.month,
          targetBalanceId: month.balanceId,
          note: `${month.month} oyi uchun to'lov`,
        },
      }).unwrap();
      setReceipt({ payment, studentName: selectedDebtor.fullName, subject: selectedDebtor.subject });
      message.success("To'lov saqlandi");
      closeDebtorPaymentModal();
    } catch (error) {
      const apiError = error as { data?: { message?: string } };
      message.error(apiError.data?.message || "To'lovni saqlab bo'lmadi");
    }
  }

  return (
    <section className="page">
      {isError ? <Alert className="page-alert" type="error" message="To'lovlar ma'lumotini yuklab bo'lmadi." showIcon /> : null}

      <Tabs
        items={[
          {
            key: 'student-payment',
            label: "O'quvchi bo'yicha",
            children: (
              <>
                <Input prefix={<Search size={17} />} allowClear value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} placeholder="Ism yoki telefon bo‘yicha qidiring" className="payments-student-search" />
                <Table rowKey="id" size="small" loading={isStudentsFetching} dataSource={studentsResponse?.data || []} pagination={false} columns={[
                  { title: "F.I.Sh", dataIndex: 'fullName' }, { title: 'Telefon', dataIndex: 'phone' },
                  { title: 'Guruh', render: (_value, record: Student) => record.group?.name || '-' },
                  { title: 'Holat', dataIndex: 'paymentStatus', render: (value) => <Tag color={value === 'paid' ? 'green' : 'red'}>{value === 'paid' ? 'Qarzsiz' : 'Qarzdor'}</Tag> },
                  { title: 'Amal', width: 130, render: (_value, record: Student) => <Button type="primary" size="small" onClick={() => { setSelectedStudent(record); studentPaymentForm.setFieldsValue({ method: 'cash', isAdvance: false }); }}>To‘lovlar</Button> },
                ]} />
              </>
            ),
          },
          {
            key: 'payments',
            label: "To'lovlar",
            children: (
              <>
                <div className="payment-overview-grid">
                  <div className="payment-overview-column">
                    <div className="payments-stat">
                      <span>Bugungi to'lov</span>
                      <strong>{formatMoney(data?.today.totalAmount)}</strong>
                      <MethodTotals totals={data?.today.totalsByMethod} />
                    </div>
                    <PaymentMethodChart
                      title="Bugungi to'lovlar ulushi"
                      total={data?.today.totalAmount}
                      totals={data?.today.totalsByMethod}
                    />
                  </div>
                  <div className="payment-overview-column">
                    <div className="payments-stat">
                      <div className="payments-stat-header">
                        <span>Yopilmagan kassa davri</span>
                        <Button
                          className="close-register-button"
                          type="primary"
                          icon={<LockKeyhole size={16} />}
                          loading={isClosing}
                          onClick={handleCloseCashRegister}
                        >
                          Kassani yopish
                        </Button>
                      </div>
                      <strong>{formatMoney(data?.openPeriod.totalAmount)}</strong>
                      <MethodTotals totals={data?.openPeriod.totalsByMethod} />
                    </div>
                    <PaymentMethodChart
                      title="Yopilmagan kassa ulushi"
                      total={data?.openPeriod.totalAmount}
                      totals={data?.openPeriod.totalsByMethod}
                    />
                  </div>
                </div>

                <Table
                  rowKey="id"
                  size="small"
                  loading={isFetching}
                  dataSource={data?.openPeriod.payments || []}
                  pagination={false}
                  scroll={{ x: 860 }}
                  columns={[
                    { title: 'Sana', dataIndex: 'paidAt', render: (value) => dayjs(value).format('DD.MM.YYYY HH:mm') },
                    { title: 'Summa', dataIndex: 'amount', render: (value) => formatMoney(value) },
                    { title: 'Usul', dataIndex: 'method', render: (value: PaymentMethod) => paymentMethodLabels[value] },
                    { title: 'Holat', dataIndex: 'cashStatus', render: () => <Tag color="orange">Yopilmagan</Tag> },
                    { title: 'Izoh', dataIndex: 'note', render: (value) => value || '-' },
                  ]}
                />

                <div className="section-gap" />

                <Table
                  rowKey="id"
                  size="small"
                  loading={isFetching}
                  dataSource={data?.pendingClosures || []}
                  pagination={false}
                  scroll={{ x: 920 }}
                  title={() => "Owner tasdig'idagi kassalar"}
                  columns={[
                    { title: 'Davr', render: (_value, record: CashClosure) => `${dayjs(record.from).format('DD.MM.YYYY HH:mm')} - ${dayjs(record.to).format('DD.MM.YYYY HH:mm')}` },
                    { title: 'Jami', dataIndex: 'totalAmount', render: (value) => formatMoney(value) },
                    { title: 'Usullar', dataIndex: 'totalsByMethod', render: (value) => <MethodTotals totals={value} /> },
                    { title: 'Soni', dataIndex: 'paymentsCount', width: 90 },
                    {
                      title: 'Amallar',
                      width: 150,
                      render: (_value, record: CashClosure) => (
                        <Space>
                          <Button size="small" icon={<Check size={15} />} loading={isReviewing} onClick={() => reviewClosure(record, 'approved')} />
                          <Button size="small" danger icon={<X size={15} />} loading={isReviewing} onClick={() => reviewClosure(record, 'rejected')} />
                        </Space>
                      ),
                    },
                  ]}
                />
              </>
            ),
          },
          {
            key: 'history',
            label: 'To‘lovlar tarixi',
            children: (
              <Table rowKey="id" size="small" loading={isHistoryFetching} dataSource={paymentHistory?.data || []} pagination={false} scroll={{ x: 900 }} columns={[
                { title: 'Sana', dataIndex: 'paidAt', render: (value) => dayjs(value).format('DD.MM.YYYY HH:mm') },
                { title: "O‘quvchi", render: (_value, record: PaymentHistoryItem) => record.student?.fullName || '-' },
                { title: 'Telefon', render: (_value, record: PaymentHistoryItem) => record.student?.phone || '-' },
                { title: 'Summa', dataIndex: 'amount', render: formatMoney },
                { title: 'Usul', dataIndex: 'method', render: (value: PaymentMethod) => paymentMethodLabels[value] || value },
                { title: 'Kassa', dataIndex: 'cashStatus', render: (value) => <Tag color={value === 'approved' ? 'green' : value === 'pending_owner' ? 'blue' : 'orange'}>{value === 'approved' ? 'Tasdiqlangan' : value === 'pending_owner' ? 'Tasdiqda' : 'Ochiq'}</Tag> },
                { title: 'Holat', dataIndex: 'status', render: (value) => <Tag color={value === 'active' ? 'green' : 'red'}>{value === 'active' ? 'Faol' : value === 'refunded' ? 'Qaytarilgan' : 'Bekor'}</Tag> },
                { title: 'Izoh', dataIndex: 'note', render: (value) => value || '-' },
              ]} />
            ),
          },
          {
            key: 'debtors',
            label: 'Qarzdorlar',
            children: (
              <Table
                rowKey="studentId"
                size="small"
                loading={isDebtorsFetching}
                dataSource={debtorsResponse?.data || []}
                pagination={false}
                scroll={{ x: 820 }}
                columns={[
                  { title: "F.I.Sh", dataIndex: 'fullName' },
                  { title: 'Telefon', dataIndex: 'phone', render: (_value, record: Debtor) => <PhoneCell debtor={record} /> },
                  { title: 'Guruh', dataIndex: 'groupName' },
                  { title: 'Umumiy qarz', dataIndex: 'totalDebt', render: (value) => <span className="danger-text">{formatMoney(value)}</span> },
                  {
                    title: 'Oylar',
                    dataIndex: 'months',
                    render: (months: Debtor['months']) => (
                      <Space wrap>
                        {months.map((item) => (
                          <Tag key={item.balanceId} color="red">
                            {item.groupName} / {item.month}: {formatMoney(item.debtAmount)}
                          </Tag>
                        ))}
                      </Space>
                    ),
                  },
                  {
                    title: "To'lov",
                    width: 110,
                    render: (_value, record: Debtor) => (
                      <Button size="small" type="primary" icon={<CircleDollarSign size={15} />} onClick={() => openDebtorPaymentModal(record)}>
                        To'lash
                      </Button>
                    ),
                  },
                ]}
              />
            ),
          },
          {
            key: 'report',
            label: 'Hisobot',
            children: (
              <div className="dashboard-panel payments-report-panel">
                <Space wrap className="page-actions">
                  <DatePicker.RangePicker value={reportRange} format="DD.MM.YYYY" allowClear={false} onChange={(values) => { if (values?.[0] && values[1]) { setReportRange([values[0], values[1]]); setReportPaymentPage(1); } }} />
                  <Button icon={<Download size={16} />} onClick={exportReport}>CSV yuklash</Button>
                </Space>
                <div className="dashboard-kpi-grid payments-report-kpi-grid">
                  <div className="payments-stat"><span>Kirim</span><strong>{formatMoney(report?.income)}</strong><small>{report?.paymentsCount || 0} ta to‘lov</small></div>
                  <div className="payments-stat"><span>Xarajat</span><strong>{formatMoney(report?.expense)}</strong><small>{report?.expensesCount || 0} ta xarajat</small></div>
                  <div className="payments-stat"><span>Sof natija</span><strong>{formatMoney(report?.net)}</strong></div>
                  <div className="payments-stat"><span>Jami qarz</span><strong>{formatMoney(report?.debt)}</strong></div>
                </div>
                {isReportFetching ? <p>Hisobot yangilanmoqda...</p> : null}
                <Space wrap className="page-actions payments-report-filters">
                  <Select
                    allowClear
                    placeholder="To'lov usuli"
                    value={reportPaymentMethod}
                    onChange={(method) => { setReportPaymentMethod(method); setReportPaymentPage(1); }}
                    options={(Object.entries(paymentMethodLabels) as [PaymentMethod, string][]).map(([value, label]) => ({ value, label }))}
                    style={{ minWidth: 180 }}
                  />
                  <Input
                    allowClear
                    prefix={<Search size={17} />}
                    placeholder="O'quvchi yoki telefon"
                    value={reportPaymentSearch}
                    onChange={(event) => { setReportPaymentSearch(event.target.value); setReportPaymentPage(1); }}
                    style={{ width: 260 }}
                  />
                </Space>
                <Table
                  rowKey="id"
                  size="small"
                  loading={isReportPaymentsFetching}
                  dataSource={reportPayments?.data || []}
                  scroll={{ x: 800 }}
                  pagination={{
                    current: reportPaymentPage,
                    pageSize: 20,
                    total: reportPayments?.pagination.total || 0,
                    showSizeChanger: false,
                    showTotal: (total) => `Jami ${total} ta to'lov`,
                    onChange: setReportPaymentPage,
                  }}
                  locale={{ emptyText: "Tanlangan davrda to'lov topilmadi" }}
                  columns={[
                    { title: 'Sana', dataIndex: 'paidAt', render: (value) => dayjs(value).format('DD.MM.YYYY HH:mm') },
                    { title: "O'quvchi", render: (_value, record: PaymentHistoryItem) => record.student?.fullName || '-' },
                    { title: 'Telefon', render: (_value, record: PaymentHistoryItem) => record.student?.phone || '-' },
                    { title: 'Summa', dataIndex: 'amount', render: formatMoney },
                    { title: 'Usul', dataIndex: 'method', render: (value: PaymentMethod) => paymentMethodLabels[value] || value },
                    { title: 'Kiritgan', dataIndex: 'createdBy', render: (value) => value?.fullName || '-' },
                    { title: 'Izoh', dataIndex: 'note', render: (value) => value || '-' },
                  ]}
                />
              </div>
            ),
          },
        ]}
      />

      <Modal className="student-payment-modal" title={selectedStudent ? `${selectedStudent.fullName} — to‘lovlar` : 'O‘quvchi to‘lovlari'} open={Boolean(selectedStudent)} onCancel={() => setSelectedStudent(null)} footer={null} width={1100}>
        {selectedStudent ? (
          <>
            <div className="finance-summary">
              <div><span>Umumiy qarz</span><strong className={selectedFinance?.summary.totalDebt ? 'danger-text' : 'success-text'}>{formatMoney(selectedFinance?.summary.totalDebt)}</strong></div>
              <div><span>Oldindan to‘lov</span><strong>{formatMoney(selectedFinance?.summary.advanceBalance)}</strong></div>
              <div><span>Telefon</span><strong>{selectedStudent.phone}</strong></div>
            </div>
            <Form form={studentPaymentForm} layout="vertical" onFinish={submitStudentPayment} className="finance-inline-form">
              <Form.Item name="method" label="To‘lov usuli" rules={[{ required: true }]}><PaymentMethodSelector /></Form.Item>
              <Form.Item name="amount" label="Summa" rules={[{ required: true, message: 'Summani kiriting' }]}><InputNumber<number> min={1} className="full-width" formatter={(value) => `${value || ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} parser={(value) => Number(value?.replace(/\s/g, '') || 0)} /></Form.Item>
              <Form.Item name="isAdvance" label="Oldindan to‘lov" valuePropName="checked"><Switch /></Form.Item>
              <Form.Item name="note" label="Izoh"><Input /></Form.Item>
              <Form.Item className="finance-submit-item"><Button type="primary" htmlType="submit" loading={isPaymentSaving}>To‘lovni saqlash</Button></Form.Item>
            </Form>
            {selectedFinance?.summary.totalDebt ? <Alert type="info" showIcon message="Oldindan to‘lov qilishdan avval barcha eski qarzlar yopilishi kerak." className="page-alert" /> : null}
            <Tabs items={[
              { key: 'debts', label: 'Qarzlar', children: <Table rowKey="id" size="small" loading={isSelectedFinanceFetching} dataSource={selectedFinance?.balances || []} pagination={false} columns={[
                { title: 'Oy', dataIndex: 'month' }, { title: 'Guruh', dataIndex: 'groupId', render: (groupId) => selectedFinance?.enrollments.find((item) => item.groupId === groupId)?.groupName || '-' },
                { title: 'Hisoblangan', dataIndex: 'chargedAmount', render: formatMoney }, { title: 'To‘langan', dataIndex: 'paidAmount', render: formatMoney },
                { title: 'Qarz', dataIndex: 'debtAmount', render: (value) => <span className={value ? 'danger-text' : 'success-text'}>{formatMoney(value)}</span> },
              ]} /> },
              { key: 'student-history', label: 'To‘lov tarixi', children: <Table rowKey="id" size="small" loading={isSelectedFinanceFetching} dataSource={selectedFinance?.payments || []} pagination={false} scroll={{ x: 900 }} columns={[
                { title: 'Sana', dataIndex: 'paidAt', render: (value) => dayjs(value).format('DD.MM.YYYY HH:mm') }, { title: 'Summa', dataIndex: 'amount', render: formatMoney },
                { title: 'Usul', dataIndex: 'method', render: (value: PaymentMethod) => paymentMethodLabels[value] || value }, { title: 'Avans', dataIndex: 'advanceAmount', render: formatMoney },
                { title: 'Kassa', dataIndex: 'cashStatus', render: (value) => <Tag>{value === 'approved' ? 'Tasdiqlangan' : value === 'pending_owner' ? 'Tasdiqda' : 'Ochiq'}</Tag> },
                { title: 'Holat', dataIndex: 'status', render: (value) => <Tag color={value === 'active' ? 'green' : 'red'}>{value === 'active' ? 'Faol' : value === 'refunded' ? 'Qaytarilgan' : 'Bekor'}</Tag> },
                { title: 'Izoh', dataIndex: 'note', render: (value) => value || '-' },
                { title: 'Amallar', render: (_value, record: Payment) => user?.role === 'owner' && record.status === 'active' ? <Space><Button size="small" icon={<Edit3 size={14} />} disabled={record.cashStatus !== 'open'} onClick={() => editPayment(record)} /><Button size="small" danger onClick={() => cancelPayment(record)}>{record.cashStatus === 'approved' ? 'Qaytarish' : 'Bekor'}</Button></Space> : null },
              ]} /> },
            ]} />
          </>
        ) : null}
      </Modal>

      <Modal
        title={selectedDebtor ? `${selectedDebtor.fullName} - qarz oylari` : 'Qarz oylari'}
        open={Boolean(selectedDebtor)}
        onCancel={closeDebtorPaymentModal}
        footer={null}
        width={680}
      >
        {selectedDebtor ? (
          <div className="debt-payment-modal">
            <div className="payment-confirm-box">
              <div>
                <span>Telefon</span>
                <strong>{selectedDebtor.phone}{selectedDebtor.secondaryPhone ? ` / ${selectedDebtor.secondaryPhone}` : ''}</strong>
              </div>
              <div>
                <span>Guruh</span>
                <strong>{selectedDebtor.groupName}</strong>
              </div>
              <div>
                <span>To'lov usuli</span>
                <PaymentMethodSelector
                  value={selectedPaymentMethod}
                  onChange={setSelectedPaymentMethod}
                />
              </div>
            </div>

            <Form
              form={multiMonthPaymentForm}
              layout="vertical"
              className="multi-month-payment-form"
              onFinish={payMultipleMonths}
            >
              <Form.Item
                name="amount"
                label="Umumiy to'lov summasi"
                rules={[
                  { required: true, message: "To'lov summasini kiriting" },
                  { type: 'number', min: 1, message: "To'lov summasi 0 dan katta bo'lishi kerak" },
                ]}
              >
                <InputNumber<number>
                  min={1}
                  className="full-width"
                  addonAfter="so'm"
                  formatter={(value) => `${value || ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
                  parser={(value) => Number(value?.replace(/\s/g, '') || 0)}
                  placeholder="Masalan: 1 200 000"
                />
              </Form.Item>
              <Form.Item name="note" label="Izoh">
                <Input placeholder="Masalan: 3 oy uchun to'lov" />
              </Form.Item>
              <Form.Item className="multi-month-payment-submit">
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={isPaymentSaving}
                  icon={<CircleDollarSign size={16} />}
                >
                  Umumiy to'lov qilish
                </Button>
              </Form.Item>
            </Form>

            <div className="payment-allocation-preview">
              <div className="payment-allocation-heading">
                <span>Summa taqsimoti</span>
                <small>Eng eski qarzdan boshlanadi</small>
              </div>
              <div className="payment-allocation-list">
                {(() => {
                  let remainder = Number(enteredPaymentAmount) || 0;

                  return selectedDebtor.months.map((month) => {
                    const allocatedAmount = Math.min(remainder, month.debtAmount);
                    remainder = Math.max(remainder - allocatedAmount, 0);

                    return (
                      <div key={month.balanceId} className={allocatedAmount > 0 ? 'is-allocated' : ''}>
                        <span>{month.groupName} / {month.month}</span>
                        <strong>{formatMoney(allocatedAmount)}</strong>
                        <small>{formatMoney(month.debtAmount)} qarz</small>
                      </div>
                    );
                  });
                })()}
                {enteredPaymentAmount > selectedDebtor.totalDebt ? (
                  <div className="is-advance">
                    <span>Avans</span>
                    <strong>{formatMoney(enteredPaymentAmount - selectedDebtor.totalDebt)}</strong>
                    <small>Keyingi oylar uchun</small>
                  </div>
                ) : null}
              </div>
            </div>

            <Table
              rowKey="balanceId"
              size="small"
              dataSource={selectedDebtor.months}
              pagination={false}
              columns={[
                { title: 'Oy', dataIndex: 'month' },
                { title: 'Guruh', dataIndex: 'groupName' },
                { title: 'Qarz', dataIndex: 'debtAmount', render: (value) => <span className="danger-text">{formatMoney(value)}</span> },
                {
                  title: "To'lash",
                  width: 110,
                  render: (_value, record: Debtor['months'][number]) => (
                    <Button
                      size="small"
                      type="primary"
                      loading={isPaymentSaving}
                      icon={<CircleDollarSign size={15} />}
                      onClick={() => payDebtMonth(record)}
                    >
                      To'lash
                    </Button>
                  ),
                },
              ]}
            />
          </div>
        ) : null}
      </Modal>

      <Modal
        title="To'lov cheki"
        open={Boolean(receipt)}
        onCancel={() => setReceipt(null)}
        footer={[
          <Button key="close" onClick={() => setReceipt(null)}>Yopish</Button>,
          <Button key="print" type="primary" icon={<Printer size={16} />} onClick={() => window.print()}>Chop etish</Button>,
        ]}
        width={420}
      >
        {receipt ? (
          <div className="receipt-print-area">
            <div className="receipt-paper">
              <BrandIdentity brand={getCourseBrand(receipt.subject, branding)} variant="receipt" />
              <div className="receipt-divider" />
              <div className="receipt-row"><span>Chek</span><strong>#{receipt.payment.id.slice(-8).toUpperCase()}</strong></div>
              <div className="receipt-row"><span>Sana</span><strong>{dayjs(receipt.payment.paidAt).format('DD.MM.YYYY HH:mm')}</strong></div>
              <div className="receipt-row"><span>O'quvchi</span><strong>{receipt.studentName}</strong></div>
              {receipt.payment.allocations.length ? (
                <div className="receipt-row"><span>Oy</span><strong>{receipt.payment.allocations.map((item) => item.month).join(', ')}</strong></div>
              ) : null}
              <div className="receipt-row"><span>Usul</span><strong>{paymentMethodLabels[receipt.payment.method]}</strong></div>
              {receipt.payment.note ? <div className="receipt-row"><span>Izoh</span><strong>{receipt.payment.note}</strong></div> : null}
              <div className="receipt-divider" />
              <div className="receipt-row receipt-total"><span>To'landi</span><strong>{formatMoney(receipt.payment.amount)}</strong></div>
              <div className="receipt-divider" />
              <p className="receipt-footer">To'lovingiz uchun rahmat</p>
            </div>
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
