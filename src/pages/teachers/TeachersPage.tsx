import { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  message,
} from 'antd';
import { Edit3, Plus, Search, Trash2, X } from 'lucide-react';
import {
  Teacher,
  TeacherFilters,
  TeacherPayload,
  useCreateTeacherMutation,
  useDeleteTeacherMutation,
  useGetTeachersQuery,
  useUpdateTeacherMutation,
} from '../../services/api';

const { TextArea } = Input;

const subjectOptions = [
  { label: 'Buxgalteriya', value: 'Buxgalteriya' },
  { label: 'IT', value: 'IT' },
  { label: 'Ingliz tili', value: 'Ingliz tili' },
  { label: 'Matematika', value: 'Matematika' },
  { label: 'Boshqa', value: 'Boshqa' },
];

const statusOptions = [
  { label: 'Faol', value: 'active' },
  { label: 'Nofaol', value: 'inactive' },
];

const genderOptions = [
  { label: 'Erkak', value: 'male' },
  { label: 'Ayol', value: 'female' },
];

type TeacherFormValues = Omit<TeacherPayload, 'status'> & {
  status?: TeacherPayload['status'];
};

const defaultValues: TeacherFormValues = {
  fullName: '',
  subject: 'IT',
  phone: '',
  gender: 'male',
  experienceYears: 0,
  monthlySalary: 0,
  salaryType: 'fixed',
  salaryPercentage: 0,
  status: 'active',
  note: '',
};

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null && 'data' in error) {
    const data = (error as { data?: { message?: string; error?: string } }).data;
    return data?.error || data?.message || fallback;
  }

  return fallback;
}

function TeacherStatusTag({ status }: { status: Teacher['status'] }) {
  return status === 'active' ? <Tag color="green">Faol</Tag> : <Tag color="red">Nofaol</Tag>;
}

export default function TeachersPage() {
  const [form] = Form.useForm<TeacherFormValues>();
  const [filters, setFilters] = useState<TeacherFilters>({});
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const salaryType = Form.useWatch('salaryType', form);

  const queryFilters = useMemo(
    () => ({
      ...filters,
      search: filters.search?.trim() || undefined,
      page,
      limit,
    }),
    [filters, limit, page],
  );

  const { data: teachersResponse, isError, isFetching } = useGetTeachersQuery(queryFilters);
  const teachers = teachersResponse?.data || [];
  const pagination = teachersResponse?.pagination;
  const [createTeacher, { isLoading: isCreating }] = useCreateTeacherMutation();
  const [updateTeacher, { isLoading: isUpdating }] = useUpdateTeacherMutation();
  const [deleteTeacher, { isLoading: isDeleting }] = useDeleteTeacherMutation();

  const isSaving = isCreating || isUpdating;

  function openCreateDrawer() {
    setEditingTeacher(null);
    form.setFieldsValue(defaultValues);
    setDrawerOpen(true);
  }

  function openEditDrawer(teacher: Teacher) {
    setEditingTeacher(teacher);
    form.setFieldsValue({
      fullName: teacher.fullName,
      subject: teacher.subject,
      phone: teacher.phone,
      gender: teacher.gender,
      experienceYears: teacher.experienceYears,
      monthlySalary: teacher.monthlySalary || 0,
      salaryType: teacher.salaryType || 'fixed',
      salaryPercentage: teacher.salaryPercentage || 0,
      status: teacher.status,
      note: teacher.note || '',
    });
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setEditingTeacher(null);
    form.resetFields();
  }

  async function handleSubmit(values: TeacherFormValues) {
    try {
      if (editingTeacher) {
        await updateTeacher({
          id: editingTeacher.id,
          body: { ...values, status: values.status || editingTeacher.status },
        }).unwrap();
        message.success("O'qituvchi ma'lumoti yangilandi");
      } else {
        await createTeacher({ ...values, status: 'active' }).unwrap();
        message.success("O'qituvchi qo'shildi");
      }

      closeDrawer();
    } catch (error) {
      message.error(getErrorMessage(error, "O'qituvchini saqlab bo'lmadi"));
    }
  }

  function confirmDelete(teacher: Teacher) {
    Modal.confirm({
      title: "O'qituvchini o'chirish",
      content: `${teacher.fullName} ma'lumotlari o'chiriladi. Davom etasizmi?`,
      okText: "O'chirish",
      cancelText: 'Bekor qilish',
      okButtonProps: { danger: true, loading: isDeleting },
      async onOk() {
        try {
          await deleteTeacher(teacher.id).unwrap();
          message.success("O'qituvchi o'chirildi");
        } catch (error) {
          message.error(getErrorMessage(error, "O'qituvchini o'chirib bo'lmadi"));
        }
      },
    });
  }

  function clearFilters() {
    setFilters({});
    setPage(1);
  }

  return (
    <section className="page">
      {isError ? <Alert className="page-alert" type="error" message="O'qituvchilar ma'lumotini yuklab bo'lmadi." showIcon /> : null}

      <div className="filter-bar">
        <Input
          allowClear
          prefix={<Search size={16} />}
          placeholder="F.I.Sh, telefon bo'yicha qidirish"
          value={filters.search}
          onChange={(event) => {
            setPage(1);
            setFilters((prev) => ({ ...prev, search: event.target.value }));
          }}
        />
        <Select
          allowClear
          placeholder="Fan"
          options={subjectOptions}
          value={filters.subject}
          onChange={(subject) => {
            setPage(1);
            setFilters((prev) => ({ ...prev, subject }));
          }}
        />
        <Select
          allowClear
          placeholder="Holat"
          options={statusOptions}
          value={filters.status}
          onChange={(status) => {
            setPage(1);
            setFilters((prev) => ({ ...prev, status }));
          }}
        />
        <Button icon={<X size={16} />} onClick={clearFilters}>
          Tozalash
        </Button>
        <Button type="primary" icon={<Plus size={16} />} onClick={openCreateDrawer}>
          O'qituvchi qo'shish
        </Button>
      </div>

      <Table
        className="teachers-table"
        rowKey="id"
        size="small"
        loading={isFetching}
        dataSource={teachers}
        scroll={{ x: 1060 }}
        pagination={{
          current: pagination?.page || page,
          pageSize: pagination?.limit || limit,
          total: pagination?.total || 0,
          showSizeChanger: false,
          onChange: (nextPage) => {
            setPage(nextPage);
          },
        }}
        columns={[
          { title: "F.I.Sh", dataIndex: 'fullName' },
          { title: 'Fan', dataIndex: 'subject' },
          { title: 'Telefon', dataIndex: 'phone' },
          {
            title: 'Tajriba',
            dataIndex: 'experienceYears',
            width: 110,
            render: (value) => `${value} yil`,
          },
          {
            title: 'Oylik maosh',
            render: (_value, record) =>
              record.salaryType === 'percentage'
                ? `${Number(record.salaryPercentage || 0)}%`
                : `${Number(record.monthlySalary || 0).toLocaleString('uz-UZ')} so'm`,
          },
          { title: 'Guruhlar', dataIndex: 'groupsCount', width: 120 },
          {
            title: 'Holat',
            dataIndex: 'status',
            width: 120,
            render: (status) => <TeacherStatusTag status={status} />,
          },
          {
            title: 'Amallar',
            width: 180,
            fixed: 'right',
            render: (_value, record) => (
              <Space>
                <Tooltip title="Tahrirlash">
                  <Button
                    className="action-edit-button"
                    size="small"
                    icon={<Edit3 size={17} />}
                    onClick={() => openEditDrawer(record)}
                  />
                </Tooltip>
                <Button size="small" danger icon={<Trash2 size={17} />} onClick={() => confirmDelete(record)} />
              </Space>
            ),
          },
        ]}
      />

      <Drawer
        title={editingTeacher ? "O'qituvchini tahrirlash" : "O'qituvchi qo'shish"}
        width="min(560px, 100vw)"
        open={drawerOpen}
        onClose={closeDrawer}
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={defaultValues} onFinish={handleSubmit}>
          <Form.Item
            name="fullName"
            label="F.I.Sh"
            rules={[
              { required: true, message: "F.I.Sh kiriting" },
              { min: 3, message: 'Kamida 3 ta belgi kiriting' },
            ]}
          >
            <Input placeholder="Masalan: Ali Karimov" />
          </Form.Item>

          <div className={editingTeacher ? 'form-grid' : 'single-field-row'}>
            <Form.Item name="subject" label="Fan" rules={[{ required: true, message: 'Fan tanlang' }]}>
              <Select options={subjectOptions} />
            </Form.Item>
            {editingTeacher ? (
              <Form.Item name="status" label="Holat" rules={[{ required: true, message: 'Holat tanlang' }]}>
                <Select options={statusOptions} />
              </Form.Item>
            ) : null}
          </div>

          <div className="form-grid">
            <Form.Item
              name="phone"
              label="Telefon"
              rules={[
                { required: true, message: 'Telefon raqam kiriting' },
                {
                  pattern: /^\+?[0-9\s()-]{7,20}$/,
                  message: "Telefon raqam noto'g'ri kiritilgan",
                },
              ]}
            >
              <Input placeholder="+998 90 123 45 67" />
            </Form.Item>
          </div>

          <div className="form-grid">
            <Form.Item name="gender" label="Jinsi" rules={[{ required: true, message: 'Jins tanlang' }]}>
              <Select options={genderOptions} />
            </Form.Item>
            <Form.Item name="experienceYears" label="Tajriba">
              <InputNumber min={0} max={60} addonAfter="yil" className="full-width" />
            </Form.Item>
          </div>

          <div className="form-grid">
            <Form.Item name="salaryType" label="Oylik turi" rules={[{ required: true }]}>
              <Select
                options={[
                  { label: 'Stabil oylik', value: 'fixed' },
                  { label: "To'lovdan foiz", value: 'percentage' },
                ]}
              />
            </Form.Item>
            {salaryType === 'percentage' ? (
              <Form.Item name="salaryPercentage" label="Foiz">
                <InputNumber min={0} max={100} addonAfter="%" className="full-width" />
              </Form.Item>
            ) : (
              <Form.Item name="monthlySalary" label="Oylik maosh">
                <InputNumber min={0} className="full-width" formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} />
              </Form.Item>
            )}
          </div>

          <Form.Item name="note" label="Izoh">
            <TextArea rows={4} placeholder="O'qituvchi haqida qo'shimcha ma'lumot" maxLength={500} showCount />
          </Form.Item>

          <div className="drawer-form-actions">
            <Button onClick={closeDrawer}>Bekor qilish</Button>
            <Button type="primary" htmlType="submit" loading={isSaving}>
              Saqlash
            </Button>
          </div>
        </Form>
      </Drawer>
    </section>
  );
}
