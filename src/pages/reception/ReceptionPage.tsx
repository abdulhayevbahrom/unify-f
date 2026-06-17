import { useState } from 'react';
import { Alert, Button, Form, Input, Select, Space, Switch, Table, Tag, Tooltip, message } from 'antd';
import dayjs from 'dayjs';
import { Plus, X } from 'lucide-react';
import {
  Group,
  Student,
  StudentPayload,
  WeekDay,
  useCreateStudentMutation,
  useGetGroupsQuery,
  useGetStudentsQuery,
} from '../../services/api';

const dayLabels = new Map<WeekDay, string>([
  ['monday', 'Dushanba'],
  ['tuesday', 'Seshanba'],
  ['wednesday', 'Chorshanba'],
  ['thursday', 'Payshanba'],
  ['friday', 'Juma'],
  ['saturday', 'Shanba'],
  ['sunday', 'Yakshanba'],
]);

const subjectOptions = [
  { label: 'Buxgalteriya', value: 'Buxgalteriya' },
  { label: 'IT', value: 'IT' },
  { label: 'Ingliz tili', value: 'Ingliz tili' },
  { label: 'Matematika', value: 'Matematika' },
  { label: 'Boshqa', value: 'Boshqa' },
];

type ReceptionFormValues = StudentPayload & {
  subject?: string;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null && 'data' in error) {
    const data = (error as { data?: { message?: string; error?: string } }).data;
    return data?.error || data?.message || fallback;
  }

  return fallback;
}

function formatDays(group: Group) {
  return group.lessonDays?.map((day) => dayLabels.get(day)).filter(Boolean).join(', ') || '-';
}

function renderGroupOption(group: Group) {
  return (
    <div className="group-select-option">
      <span className="group-option-subject">{group.subject}</span>
      <small className="group-option-time">{group.startTime}-{group.endTime}</small>
      <small className="group-option-days">{formatDays(group)}</small>
      <small className="group-option-teacher">{group.teacher?.fullName || '-'}</small>
    </div>
  );
}

export default function ReceptionPage() {
  const [form] = Form.useForm<ReceptionFormValues>();
  const [showSecondaryPhone, setShowSecondaryPhone] = useState(false);
  const [showClosedGroups, setShowClosedGroups] = useState(false);
  const selectedSubject = Form.useWatch('subject', form);
  const selectedGroupId = Form.useWatch('groupId', form);
  const { data: groupsResponse, isFetching: isGroupsFetching } = useGetGroupsQuery({ limit: 100, status: 'active' });
  const { data: studentsResponse, isFetching: isStudentsFetching } = useGetStudentsQuery({ limit: 100 });
  const [createStudent, { isLoading }] = useCreateStudentMutation();
  const groups = groupsResponse?.data || [];
  const selectedGroup = groups.find((group) => group.id === selectedGroupId);
  const weekStart = dayjs().startOf('day').subtract(dayjs().day() === 0 ? 6 : dayjs().day() - 1, 'day');
  const weeklyStudents =
    studentsResponse?.data.filter((student) => dayjs(student.createdAt).isAfter(weekStart) || dayjs(student.createdAt).isSame(weekStart)) || [];
  const groupOptions = groups
    .filter((group) => (!selectedSubject || group.subject === selectedSubject) && (showClosedGroups || group.isEnrollmentOpen))
    .map((group) => ({
      label: renderGroupOption(group),
      value: group.id,
      title: `${group.name} (${group.subject})`,
    }));

  async function handleSubmit(values: ReceptionFormValues) {
    const { subject: _subject, ...payloadValues } = values;

    try {
      await createStudent({
        ...payloadValues,
        secondaryPhone: showSecondaryPhone ? payloadValues.secondaryPhone || '' : '',
        allowClosedGroup: showClosedGroups && Boolean(selectedGroup && !selectedGroup.isEnrollmentOpen),
        status: 'active',
        paymentStatus: 'debt',
      }).unwrap();
      message.success("O'quvchi qabul qilindi");
      form.resetFields();
      setShowSecondaryPhone(false);
      setShowClosedGroups(false);
    } catch (error) {
      message.error(getErrorMessage(error, "O'quvchini qabul qilib bo'lmadi"));
    }
  }

  return (
    <section className="page">
      <div className="reception-layout">
      <div className="reception-panel">
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <div className="reception-grid">
            <Form.Item name="fullName" label="F.I.Sh" rules={[{ required: true, message: "F.I.Sh kiriting" }]}>
              <Input placeholder="Masalan: Sardor Valiyev" />
            </Form.Item>

            <Form.Item name="phone" label="Telefon" rules={[{ required: true, message: 'Telefon kiriting' }]}>
              <Input placeholder="+998 90 123 45 67" />
            </Form.Item>
            {showSecondaryPhone ? (
              <Form.Item name="secondaryPhone" label="Ikkinchi telefon">
                <Input
                  placeholder="+998 91 222 33 44"
                  suffix={
                    <Tooltip title="Olib tashlash">
                      <Button type="text" icon={<X size={15} />} onClick={() => setShowSecondaryPhone(false)} />
                    </Tooltip>
                  }
                />
              </Form.Item>
            ) : (
              <Form.Item className="secondary-phone-action">
                <Tooltip title="Ikkinchi telefon qo'shish">
                  <Button icon={<Plus size={17} />} onClick={() => setShowSecondaryPhone(true)} />
                </Tooltip>
              </Form.Item>
            )}
          </div>

          <div className="reception-subject-row">
            <Form.Item name="subject" label="Fan" rules={[{ required: true, message: 'Fan tanlang' }]}>
              <Select options={subjectOptions} onChange={() => form.setFieldValue('groupId', '')} />
            </Form.Item>
            <Form.Item className="closed-groups-toggle">
              <Space>
                <Switch checked={showClosedGroups} onChange={setShowClosedGroups} />
                <span>Yopiq guruhlarni ham ko'rsatish</span>
              </Space>
            </Form.Item>
          </div>

          <Form.Item name="groupId" label="Guruh" rules={[{ required: true, message: 'Guruh tanlang' }]}>
            <Select
              showSearch
              optionFilterProp="title"
              loading={isGroupsFetching}
              options={groupOptions}
              optionLabelProp="title"
              notFoundContent="Bu fan bo'yicha mos guruh yo'q"
            />
          </Form.Item>

          {selectedGroup ? (
            <Alert
              className="page-alert"
              type={selectedGroup.isEnrollmentOpen ? 'info' : 'warning'}
              message={`${selectedGroup.name}: ${selectedGroup.startTime}-${selectedGroup.endTime}, ${formatDays(selectedGroup)}, ${selectedGroup.teacher?.fullName || '-'}`}
              showIcon
            />
          ) : null}

          <div className="reception-grid">
            <Form.Item name="parentName" label="Ota-ona F.I.Sh">
              <Input placeholder="Masalan: Vali Valiyev" />
            </Form.Item>
            <Form.Item name="parentPhone" label="Ota-ona telefoni">
              <Input placeholder="+998 91 222 33 44" />
            </Form.Item>
          </div>

          <Form.Item name="note" label="Izoh">
            <Input.TextArea rows={4} maxLength={500} showCount />
          </Form.Item>

          <div className="drawer-form-actions">
            <Button htmlType="button" onClick={() => form.resetFields()}>
              Tozalash
            </Button>
            <Button type="primary" htmlType="submit" loading={isLoading}>
              Qabul qilish
            </Button>
          </div>
        </Form>
      </div>
      <div className="reception-panel reception-list-panel">
        <div className="panel-title-row">
          <div>
            <strong>Shu hafta qabul qilinganlar</strong>
            <span>{weeklyStudents.length} ta o'quvchi</span>
          </div>
        </div>
        <Table
          rowKey="id"
          size="small"
          loading={isStudentsFetching}
          dataSource={weeklyStudents}
          pagination={false}
          scroll={{ x: 560 }}
          columns={[
            { title: "F.I.Sh", dataIndex: 'fullName', ellipsis: true },
            { title: 'Telefon', dataIndex: 'phone', width: 145 },
            {
              title: 'Guruh',
              dataIndex: 'group',
              width: 120,
              ellipsis: true,
              render: (_value, record: Student) => record.group?.name || '-',
            },
            {
              title: 'Holat',
              dataIndex: 'paymentStatus',
              width: 92,
              render: (value: Student['paymentStatus']) =>
                value === 'paid' ? <Tag color="green">To'langan</Tag> : <Tag color="red">Qarzdor</Tag>,
            },
          ]}
        />
      </div>
      </div>
    </section>
  );
}
