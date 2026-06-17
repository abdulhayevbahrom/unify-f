import {
  Archive,
  Bell,
  BookOpen,
  Check,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  ReceiptText,
  CircleDollarSign,
  UserCog,
  UserPlus,
  UsersRound,
  Wallet,
  X,
} from 'lucide-react';
import { Badge, Button, Dropdown, Layout, Menu, Modal, Spin, Tooltip, Typography, message } from 'antd';
import dayjs from 'dayjs';
import { ReactNode, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useDispatch } from 'react-redux';
import { useAuth } from '../auth/AuthContext';
import { Permission } from '../auth/permissions';
import LoginPage from '../pages/auth/LoginPage';
import DashboardPage from '../pages/dashboard/DashboardPage';
import EmployeesPage from '../pages/employees/EmployeesPage';
import ExpensesPage from '../pages/expenses/ExpensesPage';
import GroupsPage from '../pages/groups/GroupsPage';
import PaymentsPage from '../pages/payments/PaymentsPage';
import ReceptionPage from '../pages/reception/ReceptionPage';
import SalariesPage from '../pages/salaries/SalariesPage';
import StudentsPage from '../pages/students/StudentsPage';
import TeachersPage from '../pages/teachers/TeachersPage';
import {
  AppNotification,
  CashClosure,
  api,
  useGetNotificationsQuery,
  useMarkNotificationReadMutation,
  useReviewCashClosureMutation,
} from '../services/api';

const { Header, Sider, Content } = Layout;

const navigationItems: {
  key: string;
  label: string;
  permission: Permission;
  icon: ReactNode;
}[] = [
  { key: '/dashboard', icon: <LayoutDashboard size={18} />, label: 'Dashboard', permission: 'dashboard' },
  { key: '/teachers', icon: <GraduationCap size={18} />, label: "O'qituvchilar", permission: 'teachers' },
  { key: '/groups', icon: <BookOpen size={18} />, label: 'Guruhlar', permission: 'groups' },
  { key: '/archived-groups', icon: <Archive size={18} />, label: 'Arxiv guruhlar', permission: 'archived_groups' },
  { key: '/students', icon: <UsersRound size={18} />, label: "O'quvchilar", permission: 'students' },
  { key: '/reception', icon: <UserPlus size={18} />, label: 'Reception', permission: 'reception' },
  { key: '/payments', icon: <Wallet size={18} />, label: "To'lovlar", permission: 'payments' },
  { key: '/expenses', icon: <ReceiptText size={18} />, label: 'Xarajatlar', permission: 'expenses' },
  { key: '/salaries', icon: <CircleDollarSign size={18} />, label: 'Oyliklar', permission: 'employees' },
  { key: '/employees', icon: <UserCog size={18} />, label: 'Hodimlar', permission: 'employees' },
];

const pageTitles = Object.fromEntries(navigationItems.map((item) => [item.key, item.label]));
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://blcxkb9j-4000.inc1.devtunnels.ms/api';
const socketUrl = apiBaseUrl.replace(/\/api\/?$/, '');

function formatMoney(value?: number) {
  return `${Number(value || 0).toLocaleString('uz-UZ')} so'm`;
}

function PermissionRoute({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { hasPermission } = useAuth();

  return hasPermission(permission) ? children : <Navigate to="/" replace />;
}

function NotificationBell() {
  const { user } = useAuth();
  const dispatch = useDispatch();
  const { data } = useGetNotificationsQuery(undefined, { skip: !user });
  const [reviewCashClosure, { isLoading: isReviewing }] = useReviewCashClosureMutation();
  const [markNotificationRead] = useMarkNotificationReadMutation();
  const notifications = data?.data || [];
  const ownerCanReview = user?.role === 'owner';

  useEffect(() => {
    const token = localStorage.getItem('sab_auth_token');

    if (!token || !user) return undefined;

    const socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket'],
    });

    socket.on('notification:new', (payload: { notification?: AppNotification }) => {
      message.info(payload.notification?.message || 'Yangi bildirishnoma');
      dispatch(api.util.invalidateTags([{ type: 'Notification', id: 'LIST' }, { type: 'PaymentsDashboard', id: 'CURRENT' }]));
    });

    socket.on('cash-closure:reviewed', () => {
      dispatch(api.util.invalidateTags([{ type: 'Notification', id: 'LIST' }, { type: 'PaymentsDashboard', id: 'CURRENT' }]));
    });

    return () => {
      socket.disconnect();
    };
  }, [dispatch, user]);

  async function reviewClosure(notification: AppNotification, closure: CashClosure, status: 'approved' | 'rejected') {
    try {
      await reviewCashClosure({ closureId: closure.id, status }).unwrap();
      await markNotificationRead(notification.id).unwrap().catch(() => undefined);
      message.success(status === 'approved' ? 'Kassa tasdiqlandi' : 'Kassa rad etildi');
    } catch (error) {
      const apiError = error as { data?: { message?: string } };
      message.error(apiError.data?.message || 'Amal bajarilmadi');
    }
  }

  function openClosureReview(notification: AppNotification) {
    const closure = notification.closure;

    if (!closure) {
      Modal.info({
        title: notification.title,
        content: notification.message,
        okText: 'Yopish',
        onOk: () => markNotificationRead(notification.id),
      });
      return;
    }

    Modal.confirm({
      title: 'Kassa tasdig‘i',
      content: (
        <div className="notification-review-content">
          <p>{notification.message}</p>
          <div>
            <span>Davr</span>
            <strong>{dayjs(closure.from).format('DD.MM.YYYY HH:mm')} - {dayjs(closure.to).format('DD.MM.YYYY HH:mm')}</strong>
          </div>
          <div>
            <span>To‘lovlar soni</span>
            <strong>{closure.paymentsCount}</strong>
          </div>
          <div>
            <span>Jami summa</span>
            <strong>{formatMoney(closure.totalAmount)}</strong>
          </div>
        </div>
      ),
      okText: 'Tasdiqlash',
      cancelText: 'Yopish',
      okButtonProps: { loading: isReviewing },
      onOk: () => reviewClosure(notification, closure, 'approved'),
    });
  }

  const overlay = (
    <div className="notification-dropdown">
      <div className="notification-dropdown-header">
        <strong>Bildirishnomalar</strong>
        <span>{notifications.length}</span>
      </div>
      {notifications.length ? (
        notifications.map((notification) => (
          <div
            role="button"
            tabIndex={0}
            className="notification-item"
            key={notification.id}
            onClick={() => {
              if (notification.type === 'cash_closure' && ownerCanReview) {
                openClosureReview(notification);
              } else {
                markNotificationRead(notification.id);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                openClosureReview(notification);
              }
            }}
          >
            <span>{notification.title}</span>
            <small>{notification.message}</small>
            <time>{dayjs(notification.createdAt).format('DD.MM.YYYY HH:mm')}</time>
            {notification.type === 'cash_closure' && notification.closure && ownerCanReview ? (
              <div className="notification-actions" onClick={(event) => event.stopPropagation()}>
                <Button
                  size="small"
                  type="primary"
                  icon={<Check size={14} />}
                  loading={isReviewing}
                  onClick={() => reviewClosure(notification, notification.closure as CashClosure, 'approved')}
                >
                  Tasdiqlash
                </Button>
                <Button
                  size="small"
                  danger
                  icon={<X size={14} />}
                  loading={isReviewing}
                  onClick={() => reviewClosure(notification, notification.closure as CashClosure, 'rejected')}
                >
                  Rad etish
                </Button>
              </div>
            ) : null}
          </div>
        ))
      ) : (
        <div className="notification-empty">Yangi bildirishnoma yo‘q</div>
      )}
    </div>
  );

  return (
    <Dropdown dropdownRender={() => overlay} trigger={['click']} placement="bottomRight">
      <Badge count={notifications.length} size="small">
        <Button className="header-icon-button" type="text" icon={<Bell size={19} />} />
      </Badge>
    </Dropdown>
  );
}

function Shell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, hasPermission } = useAuth();
  const allowedItems = navigationItems.filter((item) => hasPermission(item.permission));
  const defaultPath = allowedItems[0]?.key || '/login';
  const pageTitle = pageTitles[location.pathname] || "O'quv markaz boshqaruvi";

  function handleLogout() {
    logout();
    navigate('/', { replace: true });
  }

  return (
    <Layout className="app-shell">
      <Sider breakpoint="lg" collapsedWidth={0} width={272} className="app-sidebar">
        <div className="brand">
          <div className="brand-mark">U</div>
          <div>
            <Typography.Text className="brand-title">UNIFY academy</Typography.Text>
            <Typography.Text className="brand-subtitle">Boshqaruv tizimi</Typography.Text>
          </div>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          onClick={(item) => navigate(item.key)}
          items={allowedItems.map(({ key, label, icon }) => ({ key, label, icon }))}
        />
      </Sider>
      <Layout>
        <Header className="app-header">
          <Typography.Title level={4}>{pageTitle}</Typography.Title>
          <div className="header-actions">
            <Tooltip title="Bildirishnomalar">
              <NotificationBell />
            </Tooltip>
            <Typography.Text className="header-user">{user?.fullName}</Typography.Text>
            <Tooltip title="Chiqish">
              <Button className="header-icon-button" type="text" icon={<LogOut size={19} />} onClick={handleLogout} />
            </Tooltip>
          </div>
        </Header>
        <Content className="app-content">
          <Routes>
            <Route path="/" element={<Navigate to={defaultPath} replace />} />
            <Route path="/dashboard" element={<PermissionRoute permission="dashboard"><DashboardPage /></PermissionRoute>} />
            <Route path="/teachers" element={<PermissionRoute permission="teachers"><TeachersPage /></PermissionRoute>} />
            <Route path="/groups" element={<PermissionRoute permission="groups"><GroupsPage /></PermissionRoute>} />
            <Route path="/archived-groups" element={<PermissionRoute permission="archived_groups"><GroupsPage archivedOnly /></PermissionRoute>} />
            <Route path="/students" element={<PermissionRoute permission="students"><StudentsPage /></PermissionRoute>} />
            <Route path="/reception" element={<PermissionRoute permission="reception"><ReceptionPage /></PermissionRoute>} />
            <Route path="/payments" element={<PermissionRoute permission="payments"><PaymentsPage /></PermissionRoute>} />
            <Route path="/expenses" element={<PermissionRoute permission="expenses"><ExpensesPage /></PermissionRoute>} />
            <Route path="/salaries" element={<PermissionRoute permission="employees"><SalariesPage /></PermissionRoute>} />
            <Route path="/employees" element={<PermissionRoute permission="employees"><EmployeesPage /></PermissionRoute>} />
            <Route path="*" element={<Navigate to={defaultPath} replace />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

function AuthGate() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="auth-loading"><Spin size="large" /></div>;
  }

  return user ? <Shell /> : <LoginPage />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthGate />
    </BrowserRouter>
  );
}
