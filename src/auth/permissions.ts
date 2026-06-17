export type Permission =
  | 'dashboard'
  | 'teachers'
  | 'groups'
  | 'archived_groups'
  | 'students'
  | 'reception'
  | 'payments'
  | 'expenses'
  | 'employees';

export const permissionOptions: { label: string; value: Permission }[] = [
  { label: 'Dashboard', value: 'dashboard' },
  { label: "O'qituvchilar", value: 'teachers' },
  { label: 'Guruhlar', value: 'groups' },
  { label: 'Arxiv guruhlar', value: 'archived_groups' },
  { label: "O'quvchilar", value: 'students' },
  { label: 'Reception', value: 'reception' },
  { label: "To'lovlar", value: 'payments' },
  { label: 'Xarajatlar', value: 'expenses' },
  { label: 'Hodimlar', value: 'employees' },
];

export const allPermissions = permissionOptions.map((permission) => permission.value);
