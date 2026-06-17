import { useState } from 'react';
import { Alert, Button, Form, Input, InputNumber, Modal, Space, Table, Tabs, Tag, message } from 'antd';
import dayjs from 'dayjs';
import { Check, CircleDollarSign, LockKeyhole, X } from 'lucide-react';
import {
  CashClosure,
  Debtor,
  PaymentMethod,
  useCloseCashRegisterMutation,
  useCreatePaymentMutation,
  useGetDebtorsQuery,
  useGetPaymentsDashboardQuery,
  useReviewCashClosureMutation,
} from '../../services/api';
import PaymentMethodSelector from '../../components/PaymentMethodSelector';

type MultiMonthPaymentFormValues = {
  amount: number;
  note?: string;
};

const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: 'Naqd',
  card: 'Karta',
  bank_transfer: "Bank o'tkazma",
  click: 'Click',
  payme: 'Payme',
  other: 'Boshqa',
};

const paymentMethodColors: Record<PaymentMethod, string> = {
  cash: '#e83f63',
  card: '#3a86ff',
  bank_transfer: '#20c997',
  click: '#f59e0b',
  payme: '#8b5cf6',
  other: '#aeb4c0',
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
  const [multiMonthPaymentForm] = Form.useForm<MultiMonthPaymentFormValues>();
  const [selectedDebtor, setSelectedDebtor] = useState<Debtor | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('cash');
  const enteredPaymentAmount = Form.useWatch('amount', multiMonthPaymentForm) || 0;
  const { data, isError, isFetching } = useGetPaymentsDashboardQuery();
  const { data: debtorsResponse, isFetching: isDebtorsFetching } = useGetDebtorsQuery();
  const [closeCashRegister, { isLoading: isClosing }] = useCloseCashRegisterMutation();
  const [createPayment, { isLoading: isPaymentSaving }] = useCreatePaymentMutation();
  const [reviewCashClosure, { isLoading: isReviewing }] = useReviewCashClosureMutation();

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
      await createPayment({
        studentId: selectedDebtor.studentId,
        body: {
          amount: values.amount,
          method: selectedPaymentMethod,
          note: values.note?.trim() || "Bir nechta oy uchun to'lov",
        },
      }).unwrap();
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
      await createPayment({
        studentId: selectedDebtor.studentId,
        body: {
          amount: month.debtAmount,
          method: selectedPaymentMethod,
          targetMonth: month.month,
          note: `${month.month} oyi uchun to'lov`,
        },
      }).unwrap();
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
                          <Tag key={item.month} color="red">
                            {item.month}: {formatMoney(item.debtAmount)}
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
        ]}
      />

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
                <InputNumber
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
                      <div key={month.month} className={allocatedAmount > 0 ? 'is-allocated' : ''}>
                        <span>{month.month}</span>
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
              rowKey="month"
              size="small"
              dataSource={selectedDebtor.months}
              pagination={false}
              columns={[
                { title: 'Oy', dataIndex: 'month' },
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
    </section>
  );
}
