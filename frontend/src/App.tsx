import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './layout/Layout';
import { useAuth } from './lib/auth';
import { RequirePermission } from './components/ui';

// صفحات بدون احراز هویت
const Login = lazy(() => import('./pages/Login'));

// صفحات اصلی
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Approvals = lazy(() => import('./pages/Approvals'));
const Employees = lazy(() => import('./pages/Employees'));
const Contracts = lazy(() => import('./pages/Contracts'));
const Documents = lazy(() => import('./pages/Documents'));
const Attendance = lazy(() => import('./pages/Attendance'));
const Shifts = lazy(() => import('./pages/Shifts'));
const Leaves = lazy(() => import('./pages/Leaves'));
const Missions = lazy(() => import('./pages/Missions'));
const Payroll = lazy(() => import('./pages/Payroll'));
const Evaluations = lazy(() => import('./pages/Evaluations'));
const Tasks = lazy(() => import('./pages/Tasks'));
const Projects = lazy(() => import('./pages/Projects'));
const EmployeePanel = lazy(() => import('./pages/EmployeePanel'));
const Assets = lazy(() => import('./pages/Assets'));
const Training = lazy(() => import('./pages/Training'));
const Loans = lazy(() => import('./pages/Loans'));
const Recruitment = lazy(() => import('./pages/Recruitment'));
const Lifecycle = lazy(() => import('./pages/Lifecycle'));
const Admin = lazy(() => import('./pages/Admin'));
const Announcements = lazy(() => import('./pages/Announcements'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Reports = lazy(() => import('./pages/Reports'));
const Users = lazy(() => import('./pages/Users'));
const Roles = lazy(() => import('./pages/Roles'));
const Org = lazy(() => import('./pages/Org'));
const Audit = lazy(() => import('./pages/Audit'));
const Settings = lazy(() => import('./pages/Settings'));
const Backup = lazy(() => import('./pages/Backup'));

function PageLoading() {
  return (
    <div className="flex" style={{ padding: 40, justifyContent: 'center' }}>
      <span className="spinner" style={{ width: 28, height: 28 }} />
    </div>
  );
}

/** محافظ مسیر: فقط کاربر واردشده اجازه دارد */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoading />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/**
 * صفحهٔ خانه: مدیران داشبورد مدیریتی را می‌بینند و کارکنان عادی به پنل خودشان هدایت می‌شوند.
 */
function HomeRoute() {
  const { user, hasPermission } = useAuth();
  if (
    !hasPermission('dashboard.view.management') &&
    hasPermission('panel.view') &&
    user?.employee
  ) {
    return <Navigate to="/panel" replace />;
  }
  return <Dashboard />;
}

export default function App() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<HomeRoute />} />
          <Route path="/approvals" element={<RequirePermission anyOf={['approvals.view']}><Approvals /></RequirePermission>} />
          <Route path="/employees" element={<RequirePermission anyOf={['employees.view']}><Employees /></RequirePermission>} />
          <Route path="/contracts" element={<RequirePermission anyOf={['contracts.view']}><Contracts /></RequirePermission>} />
          <Route path="/documents" element={<RequirePermission anyOf={['documents.view']}><Documents /></RequirePermission>} />
          <Route path="/attendance" element={<RequirePermission anyOf={['attendance.view']}><Attendance /></RequirePermission>} />
          <Route path="/shifts" element={<RequirePermission anyOf={['shifts.view']}><Shifts /></RequirePermission>} />
          <Route path="/leaves" element={<RequirePermission anyOf={['leaves.view']}><Leaves /></RequirePermission>} />
          <Route path="/missions" element={<RequirePermission anyOf={['missions.view']}><Missions /></RequirePermission>} />
          <Route path="/payroll" element={<RequirePermission anyOf={['payroll.view', 'payroll.view.own']}><Payroll /></RequirePermission>} />
          <Route path="/evaluations" element={<RequirePermission anyOf={['evaluations.view']}><Evaluations /></RequirePermission>} />
          <Route path="/tasks" element={<RequirePermission anyOf={['tasks.view']}><Tasks /></RequirePermission>} />
          <Route path="/projects" element={<RequirePermission anyOf={['projects.view']}><Projects /></RequirePermission>} />
          <Route path="/panel" element={<RequirePermission anyOf={['panel.view']}><EmployeePanel /></RequirePermission>} />
          <Route path="/assets" element={<RequirePermission anyOf={['assets.view']}><Assets /></RequirePermission>} />
          <Route path="/training" element={<RequirePermission anyOf={['training.view']}><Training /></RequirePermission>} />
          <Route path="/loans" element={<RequirePermission anyOf={['loans.view']}><Loans /></RequirePermission>} />
          <Route path="/recruitment" element={<RequirePermission anyOf={['recruitment.view']}><Recruitment /></RequirePermission>} />
          <Route path="/lifecycle" element={<RequirePermission anyOf={['lifecycle.view']}><Lifecycle /></RequirePermission>} />
          <Route path="/admin" element={<RequirePermission anyOf={['admin.view']}><Admin /></RequirePermission>} />
          <Route path="/announcements" element={<RequirePermission anyOf={['announcements.view']}><Announcements /></RequirePermission>} />
          <Route path="/notifications" element={<RequirePermission anyOf={['notifications.view']}><Notifications /></RequirePermission>} />
          <Route path="/reports" element={<RequirePermission anyOf={['reports.view']}><Reports /></RequirePermission>} />
          <Route path="/users" element={<RequirePermission anyOf={['users.view']}><Users /></RequirePermission>} />
          <Route path="/roles" element={<RequirePermission anyOf={['roles.view']}><Roles /></RequirePermission>} />
          <Route path="/org" element={<RequirePermission anyOf={['org.view']}><Org /></RequirePermission>} />
          <Route path="/audit" element={<RequirePermission anyOf={['audit.view']}><Audit /></RequirePermission>} />
          <Route path="/settings" element={<RequirePermission anyOf={['settings.view']}><Settings /></RequirePermission>} />
          <Route path="/backup" element={<RequirePermission anyOf={['backup.manage']}><Backup /></RequirePermission>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
