import { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  DatePicker,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  TimePicker,
  Tooltip,
  message,
} from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { Archive, Edit3, History, Info, Plus, Search, Trash2, UsersRound, X } from 'lucide-react';
import {
  Group,
  GroupFilters,
  GroupPayload,
  Student,
  useCreateGroupMutation,
  useDeleteGroupMutation,
  useGetGroupsQuery,
  useGetStudentsQuery,
  useGetTeachersQuery,
  useUpdateGroupMutation,
  WeekDay,
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

const lessonDayOptions: { label: string; value: WeekDay }[] = [
  { label: 'Dushanba', value: 'monday' },
  { label: 'Seshanba', value: 'tuesday' },
  { label: 'Chorshanba', value: 'wednesday' },
  { label: 'Payshanba', value: 'thursday' },
  { label: 'Juma', value: 'friday' },
  { label: 'Shanba', value: 'saturday' },
  { label: 'Yakshanba', value: 'sunday' },
];

const dayLabels = new Map(lessonDayOptions.map((day) => [day.value, day.label]));

type GroupFormValues = Omit<GroupPayload, 'startTime' | 'endTime' | 'startDate'> & {
  startTime?: Dayjs | null;
  endTime?: Dayjs | null;
  startDate?: Dayjs | null;
};

const defaultValues: GroupFormValues = {
  name: '',
  subject: 'IT',
  teacherId: '',
  room: '',
  lessonDays: [],
  startTime: '',
  endTime: '',
  startDate: null,
  monthlyPrice: 0,
  priceChangeReason: '',
  isEnrollmentOpen: true,
  status: 'active',
  note: '',
};

function parseTime(value?: string) {
  return value ? dayjs(value, 'HH:mm') : null;
}

function formatTime(value?: Dayjs | null) {
  return value ? value.format('HH:mm') : '';
}

function isEndTimeAfterStart(startTime?: Dayjs | null, endTime?: Dayjs | null) {
  if (!startTime || !endTime) {
    return true;
  }

  return endTime.isAfter(startTime);
}

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null && 'data' in error) {
    const data = (error as { data?: { message?: string; error?: string } }).data;
    return data?.error || data?.message || fallback;
  }

  return fallback;
}

function GroupStatusTag({ status }: { status: Group['status'] }) {
  if (status === 'active') return <Tag color="green">Faol</Tag>;
  if (status === 'archived') return <Tag color="default">Arxiv</Tag>;
  return <Tag color="red">Nofaol</Tag>;
}

function formatSchedule(group: Group) {
  const days = group.lessonDays?.map((day) => dayLabels.get(day)).filter(Boolean).join(', ');
  const time = group.startTime && group.endTime ? `${group.startTime}-${group.endTime}` : '-';

  return (
    <div className="schedule-cell">
      <span>{time}</span>
      <small>{days || '-'}</small>
    </div>
  );
}

function formatMoney(value: number) {
  return `${Number(value).toLocaleString('uz-UZ')} so'm`;
}

function formatDate(value?: string | null) {
  return value ? dayjs(value).format('DD.MM.YYYY HH:mm') : 'Hozirgacha';
}

type GroupsPageProps = {
  archivedOnly?: boolean;
};

export default function GroupsPage({ archivedOnly = false }: GroupsPageProps) {
  const [form] = Form.useForm<GroupFormValues>();
  const [filters, setFilters] = useState<GroupFilters>({});
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [historyGroup, setHistoryGroup] = useState<Group | null>(null);
  const [studentsGroup, setStudentsGroup] = useState<Group | null>(null);
  const [detailsGroup, setDetailsGroup] = useState<Group | null>(null);
  const selectedSubject = Form.useWatch('subject', form);

  const queryFilters = useMemo(
    () => ({
      ...filters,
      status: archivedOnly ? 'archived' : filters.status,
      search: filters.search?.trim() || undefined,
      page,
      limit,
    }),
    [archivedOnly, filters, limit, page],
  );

  const { data: groupsResponse, isError, isFetching } = useGetGroupsQuery(queryFilters);
  const { data: groupStudentsResponse, isFetching: isGroupStudentsFetching } = useGetStudentsQuery(
    studentsGroup ? { groupId: studentsGroup.id, limit: 100 } : undefined,
    { skip: !studentsGroup },
  );
  const { data: teachersResponse, isFetching: isTeachersFetching } = useGetTeachersQuery({ limit: 100, status: 'active' });
  const [createGroup, { isLoading: isCreating }] = useCreateGroupMutation();
  const [updateGroup, { isLoading: isUpdating }] = useUpdateGroupMutation();
  const [deleteGroup, { isLoading: isDeleting }] = useDeleteGroupMutation();

  const groups = groupsResponse?.data || [];
  const pagination = groupsResponse?.pagination;
  const isSaving = isCreating || isUpdating;
  const allTeacherOptions =
    teachersResponse?.data.map((teacher) => ({
      label: teacher.fullName,
      value: teacher.id,
      subject: teacher.subject,
    })) || [];
  const drawerTeacherOptions = allTeacherOptions.filter((teacher) => teacher.subject === selectedSubject);
  const filterTeacherOptions = allTeacherOptions.map(({ label, value }) => ({ label, value }));

  function openCreateDrawer() {
    setEditingGroup(null);
    form.setFieldsValue({ ...defaultValues, startDate: dayjs().startOf('day') });
    setDrawerOpen(true);
  }

  function openEditDrawer(group: Group) {
    setEditingGroup(group);
    form.setFieldsValue({
      name: group.name,
      subject: group.subject,
      teacherId: group.teacherId,
      room: group.room || '',
      lessonDays: group.lessonDays || [],
      startTime: parseTime(group.startTime),
      endTime: parseTime(group.endTime),
      startDate: dayjs(group.startDate || group.createdAt),
      monthlyPrice: group.monthlyPrice || 0,
      priceChangeReason: '',
      isEnrollmentOpen: group.isEnrollmentOpen !== false,
      status: group.status,
      note: group.note || '',
    });
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setEditingGroup(null);
    form.resetFields();
  }

  async function handleSubmit(values: GroupFormValues) {
    const payload: GroupPayload = {
      ...values,
      monthlyPrice: Number(values.monthlyPrice) || 0,
      startTime: formatTime(values.startTime),
      endTime: formatTime(values.endTime),
      startDate: values.startDate?.format('YYYY-MM-DD') || '',
    };

    try {
      if (editingGroup) {
        await updateGroup({ id: editingGroup.id, body: payload }).unwrap();
        message.success("Guruh ma'lumoti yangilandi");
      } else {
        await createGroup(payload).unwrap();
        message.success("Guruh qo'shildi");
      }

      closeDrawer();
    } catch (error) {
      message.error(getErrorMessage(error, 'Guruhni saqlab bo\'lmadi'));
    }
  }

  function confirmDelete(group: Group) {
    Modal.confirm({
      title: "Guruhni o'chirish",
      content: `${group.name} ma'lumotlari o'chiriladi. Davom etasizmi?`,
      okText: "O'chirish",
      cancelText: 'Bekor qilish',
      okButtonProps: { danger: true, loading: isDeleting },
      async onOk() {
        try {
          await deleteGroup(group.id).unwrap();
          message.success("Guruh o'chirildi");
        } catch (error) {
          message.error(getErrorMessage(error, "Guruhni o'chirib bo'lmadi"));
        }
      },
    });
  }

  function confirmArchive(group: Group) {
    Modal.confirm({
      title: 'Guruhni arxivlash',
      content: `${group.name} arxivlanadi. Shu vaqtdan boshlab qabul yopiladi va keyingi to'lovlar hisoblanmaydi.`,
      okText: 'Arxivlash',
      cancelText: 'Bekor qilish',
      okButtonProps: { loading: isUpdating },
      async onOk() {
        try {
          await updateGroup({
            id: group.id,
            body: {
              name: group.name,
              subject: group.subject,
              teacherId: group.teacherId,
              room: group.room,
              lessonDays: group.lessonDays,
              startTime: group.startTime,
              endTime: group.endTime,
              startDate: group.startDate || group.createdAt,
              monthlyPrice: group.monthlyPrice,
              isEnrollmentOpen: false,
              status: 'archived',
              note: group.note || '',
            },
          }).unwrap();
          message.success('Guruh arxivlandi');
        } catch (error) {
          message.error(getErrorMessage(error, 'Guruhni arxivlab bo\'lmadi'));
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
      {isError ? <Alert className="page-alert" type="error" message="Guruhlar ma'lumotini yuklab bo'lmadi." showIcon /> : null}

      <div className={`filter-bar ${archivedOnly ? 'archived-groups-filter-bar' : 'groups-filter-bar'}`}>
        <Input
          allowClear
          prefix={<Search size={16} />}
          placeholder="Guruh nomi, fan yoki xona bo'yicha qidirish"
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
          showSearch
          optionFilterProp="label"
          placeholder="O'qituvchi"
          loading={isTeachersFetching}
          options={filterTeacherOptions}
          value={filters.teacherId}
          onChange={(teacherId) => {
            setPage(1);
            setFilters((prev) => ({ ...prev, teacherId }));
          }}
        />
        {!archivedOnly ? (
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
        ) : null}
        <Button icon={<X size={16} />} onClick={clearFilters}>
          Tozalash
        </Button>
        {!archivedOnly ? (
          <Button type="primary" icon={<Plus size={16} />} onClick={openCreateDrawer}>
            Guruh qo'shish
          </Button>
        ) : null}
      </div>

      <Table
        className="groups-table"
        rowKey="id"
        size="small"
        loading={isFetching}
        dataSource={groups}
        pagination={{
          current: pagination?.page || page,
          pageSize: pagination?.limit || limit,
          total: pagination?.total || 0,
          showSizeChanger: false,
          onChange: (nextPage) => setPage(nextPage),
        }}
        columns={[
          { title: 'Guruh nomi', dataIndex: 'name', width: 120, ellipsis: true },
          { title: 'Fan', dataIndex: 'subject', width: 90, ellipsis: true },
          {
            title: "O'qituvchi",
            dataIndex: 'teacher',
            width: 180,
            ellipsis: true,
            render: (_value, record: Group) => record.teacher?.fullName || '-',
          },
          {
            title: 'Jadval',
            dataIndex: 'lessonDays',
            width: 220,
            render: (_value, record: Group) => formatSchedule(record),
          },
          {
            title: 'Narx',
            dataIndex: 'monthlyPrice',
            width: 120,
            render: (value) => (value ? formatMoney(value) : '-'),
          },
          { title: "O'quvchilar", dataIndex: 'studentsCount', width: 95 },
          {
            title: 'Holat',
            dataIndex: 'status',
            width: 160,
            render: (status, record: Group) => (
              <Space size={4}>
                <GroupStatusTag status={status} />
                <Tag color={record.isEnrollmentOpen ? 'blue' : 'default'}>
                  {record.isEnrollmentOpen ? 'Qabul ochiq' : 'Qabul yopiq'}
                </Tag>
              </Space>
            ),
          },
          {
            title: 'Amallar',
            width: archivedOnly ? 112 : 168,
            render: (_value, record) => (
              <Space>
                {archivedOnly ? (
                  <Tooltip title="Guruh haqida">
                    <Button
                      className="action-info-button"
                      size="small"
                      icon={<Info size={17} />}
                      onClick={() => setDetailsGroup(record)}
                    />
                  </Tooltip>
                ) : null}
                <Tooltip title="Narx tarixi">
                  <Button
                    className="action-history-button"
                    size="small"
                    icon={<History size={17} />}
                    onClick={() => setHistoryGroup(record)}
                  />
                </Tooltip>
                <Tooltip title="Guruh o'quvchilari">
                  <Button
                    className="action-finance-button"
                    size="small"
                    icon={<UsersRound size={17} />}
                    onClick={() => setStudentsGroup(record)}
                  />
                </Tooltip>
                {!archivedOnly ? (
                  <>
                    <Tooltip title="Tahrirlash">
                      <Button
                        className="action-edit-button"
                        size="small"
                        icon={<Edit3 size={17} />}
                        onClick={() => openEditDrawer(record)}
                      />
                    </Tooltip>
                    {record.status !== 'archived' ? (
                      <Tooltip title="Arxivlash">
                        <Button
                          className="action-archive-button"
                          size="small"
                          icon={<Archive size={17} />}
                          onClick={() => confirmArchive(record)}
                        />
                      </Tooltip>
                    ) : null}
                    <Button size="small" danger icon={<Trash2 size={17} />} onClick={() => confirmDelete(record)} />
                  </>
                ) : null}
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={detailsGroup ? `${detailsGroup.name} - guruh haqida` : 'Guruh haqida'}
        open={Boolean(detailsGroup)}
        onCancel={() => setDetailsGroup(null)}
        footer={null}
        width={520}
      >
        <Descriptions bordered column={1} size="small">
          <Descriptions.Item label="Guruh ochilgan">{formatDate(detailsGroup?.createdAt)}</Descriptions.Item>
          <Descriptions.Item label="Dars boshlangan">
            {formatDate(detailsGroup?.startDate || detailsGroup?.createdAt)}
          </Descriptions.Item>
          <Descriptions.Item label="Arxivlangan">{formatDate(detailsGroup?.endedAt)}</Descriptions.Item>
        </Descriptions>
      </Modal>

      <Drawer
        title={editingGroup ? 'Guruhni tahrirlash' : "Guruh qo'shish"}
        width="min(620px, 100vw)"
        open={drawerOpen}
        onClose={closeDrawer}
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={defaultValues} onFinish={handleSubmit}>
          <Form.Item
            name="name"
            label="Guruh nomi"
            rules={[
              { required: true, message: 'Guruh nomini kiriting' },
              { min: 2, message: 'Kamida 2 ta belgi kiriting' },
            ]}
          >
            <Input placeholder="Masalan: Frontend N15" />
          </Form.Item>

          <div className="form-grid">
            <Form.Item name="subject" label="Fan" rules={[{ required: true, message: 'Fan tanlang' }]}>
              <Select options={subjectOptions} onChange={() => form.setFieldValue('teacherId', '')} />
            </Form.Item>
            <Form.Item name="status" label="Holat" rules={[{ required: true, message: 'Holat tanlang' }]}>
              <Select options={statusOptions} />
            </Form.Item>
          </div>

          <Form.Item name="isEnrollmentOpen" label="Qabul ochiq" valuePropName="checked">
            <Switch checkedChildren="Ochiq" unCheckedChildren="Yopiq" />
          </Form.Item>

          <Form.Item name="teacherId" label="O'qituvchi" rules={[{ required: true, message: "O'qituvchi tanlang" }]}>
            <Select
              showSearch
              optionFilterProp="label"
              loading={isTeachersFetching}
              options={drawerTeacherOptions}
              placeholder="Tanlangan fan bo'yicha o'qituvchi tanlang"
              notFoundContent="Bu fan bo'yicha faol o'qituvchi yo'q"
            />
          </Form.Item>

          <div className="form-grid">
            <Form.Item name="room" label="Xona" rules={[{ required: true, message: 'Xona kiriting' }]}>
              <Input placeholder="Masalan: 2-xona" />
            </Form.Item>
            <Form.Item
              name="monthlyPrice"
              label="Oylik to'lov"
              rules={[
                { required: true, message: "Oylik to'lov kiriting" },
                {
                  type: 'number',
                  min: 1,
                  message: "Oylik to'lov 0 dan katta bo'lishi kerak",
                },
              ]}
            >
              <InputNumber
                min={0}
                addonAfter="so'm"
                className="full-width"
                formatter={(value) => `${value || ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
                parser={(value) => Number(value?.replace(/\s/g, '') || 0)}
              />
            </Form.Item>
          </div>

          <Form.Item name="priceChangeReason" label="Narx o'zgarish sababi">
            <Input placeholder={editingGroup ? "Masalan: yangi oy uchun narx o'zgardi" : 'Boshlangich narx'} />
          </Form.Item>

          <Form.Item
            name="lessonDays"
            label="Dars kunlari"
            rules={[{ required: true, message: 'Kamida bitta dars kuni tanlang' }]}
          >
            <Select mode="multiple" options={lessonDayOptions} placeholder="Kunlarni tanlang" />
          </Form.Item>

          <Form.Item
            name="startDate"
            label="Dars boshlanish sanasi"
            rules={[{ required: true, message: 'Dars boshlanish sanasini tanlang' }]}
          >
            <DatePicker className="full-width" format="DD.MM.YYYY" placeholder="Sanani tanlang" />
          </Form.Item>

          <div className="form-grid">
            <Form.Item
              name="startTime"
              label="Boshlanish vaqti"
              rules={[{ required: true, message: 'Boshlanish vaqtini tanlang' }]}
            >
              <TimePicker format="HH:mm" minuteStep={5} className="full-width" placeholder="09:00" />
            </Form.Item>
            <Form.Item
              name="endTime"
              label="Tugash vaqti"
              dependencies={['startTime']}
              rules={[
                { required: true, message: 'Tugash vaqtini tanlang' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (isEndTimeAfterStart(getFieldValue('startTime'), value)) {
                      return Promise.resolve();
                    }

                    return Promise.reject(new Error("Tugash vaqti boshlanish vaqtidan keyin bo'lishi kerak"));
                  },
                }),
              ]}
            >
              <TimePicker format="HH:mm" minuteStep={5} className="full-width" placeholder="11:00" />
            </Form.Item>
          </div>

          <Form.Item name="note" label="Izoh">
            <TextArea rows={4} placeholder="Guruh haqida qo'shimcha ma'lumot" maxLength={500} showCount />
          </Form.Item>

          <div className="drawer-form-actions">
            <Button onClick={closeDrawer}>Bekor qilish</Button>
            <Button type="primary" htmlType="submit" loading={isSaving}>
              Saqlash
            </Button>
          </div>
        </Form>
      </Drawer>

      <Modal
        title={studentsGroup ? `${studentsGroup.name} - o'quvchilar` : "Guruh o'quvchilari"}
        open={Boolean(studentsGroup)}
        onCancel={() => setStudentsGroup(null)}
        footer={null}
        width={820}
      >
        <Table
          rowKey="id"
          size="small"
          loading={isGroupStudentsFetching}
          dataSource={groupStudentsResponse?.data || []}
          pagination={false}
          scroll={{ x: 680 }}
          columns={[
            { title: "F.I.Sh", dataIndex: 'fullName' },
            { title: 'Telefon', dataIndex: 'phone' },
            {
              title: 'Holat',
              dataIndex: 'status',
              render: (value: Student['status']) => {
                if (value === 'active') return <Tag color="green">Faol</Tag>;
                if (value === 'paused') return <Tag color="orange">Pauzada</Tag>;
                if (value === 'left') return <Tag color="red">Ketgan</Tag>;
                return <Tag>Nofaol</Tag>;
              },
            },
            {
              title: "To'lov",
              dataIndex: 'paymentStatus',
              render: (value: Student['paymentStatus']) => (value === 'paid' ? <Tag color="green">To'langan</Tag> : <Tag color="red">Qarzdor</Tag>),
            },
          ]}
        />
      </Modal>

      <Modal
        title={historyGroup ? `${historyGroup.name} - oylik to'lov tarixi` : "Oylik to'lov tarixi"}
        open={Boolean(historyGroup)}
        onCancel={() => setHistoryGroup(null)}
        footer={null}
        width={760}
      >
        <Table
          rowKey={(record) => `${record.startedAt}-${record.price}`}
          size="small"
          pagination={false}
          dataSource={historyGroup?.priceHistory || []}
          columns={[
            {
              title: 'Narx',
              dataIndex: 'price',
              render: (value) => formatMoney(value),
            },
            {
              title: 'Boshlangan',
              dataIndex: 'startedAt',
              render: (value) => formatDate(value),
            },
            {
              title: 'Tugagan',
              dataIndex: 'endedAt',
              render: (value) => formatDate(value),
            },
            {
              title: 'Sabab',
              dataIndex: 'reason',
              render: (value) => value || '-',
            },
          ]}
        />
      </Modal>
    </section>
  );
}
