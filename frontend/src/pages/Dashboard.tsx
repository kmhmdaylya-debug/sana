import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { api } from '../lib/api';
import { apiErrorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Card, PageHeader, Badge } from '../components/ui';
import { toPersianDigits, statusLabel, badgeKind } from '../lib/format';
import { useToast } from '../components/ui';

interface MyDashboard {
  unreadNotifications: number;
  myActiveLeaves: number;
  myOpenTasks: number;
  myPendingSwaps: number;
}

interface ManagementDashboard {
  employees: { total: number; active: number };
  byStatus: { status: string; count: number }[];
  pending: { leaves: number; corrections: number; missions: number; swaps: number; loans: number };
  expiringContracts: number;
  absentToday: number;
  openTasks: number;
  monthAttendance: { records: number; workMinutes: number; overtimeMinutes: number; lateMinutes: number };
}

function fmtMinutes(m: number) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return h > 0 ? `${toPersianDigits(h)} ساعت${mm ? ` و ${toPersianDigits(mm)} دقیقه` : ''}` : `${toPersianDigits(mm)} دقیقه`;
}

export default function Dashboard() {
  const { user, hasPermission } = useAuth();
  const toast = useToast();
  const [my, setMy] = useState<MyDashboard | null>(null);
  const [mgmt, setMgmt] = useState<ManagementDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const canMgmt = hasPermission('dashboard.view.management');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const r = await api.get('/dashboard/me');
        if (active) setMy(r?.data?.data ?? null);
        if (canMgmt) {
          const m = await api.get('/dashboard/management');
          if (active) setMgmt(m?.data?.data ?? null);
        }
      } catch (e) {
        toast('error', apiErrorMessage(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [canMgmt, toast]);

  const statusData = (mgmt?.byStatus ?? []).map((s) => ({ name: statusLabel(s.status), count: s.count }));

  return (
    <>
      <PageHeader
        title={`سلام ${user?.fullName ?? ''} 👋`}
        subtitle="خلاصهٔ وضعیت شما و سازمان در یک نگاه"
      />

      {/* داشبورد شخصی */}
      <div className="grid grid-4 mb">
        <StatCard color="blue" label="اعلان خوانده‌نشده" value={my ? toPersianDigits(my.unreadNotifications) : '…'} link="/notifications" />
        <StatCard color="amber" label="مرخصی‌های در جریان من" value={my ? toPersianDigits(my.myActiveLeaves) : '…'} link="/leaves" />
        <StatCard color="sky" label="وظایف باز من" value={my ? toPersianDigits(my.myOpenTasks) : '…'} link="/tasks" />
        <StatCard color="violet" label="درخواست تعویض شیفت" value={my ? toPersianDigits(my.myPendingSwaps) : '…'} link="/shifts" />
      </div>

      {canMgmt && mgmt && (
        <>
          <div className="grid grid-4 mb">
            <StatCard color="blue" label="کل نیروها" value={toPersianDigits(mgmt.employees.total)} link="/employees" />
            <StatCard color="green" label="نیروهای فعال" value={toPersianDigits(mgmt.employees.active)} link="/employees" />
            <StatCard color="red" label="غایب امروز" value={toPersianDigits(mgmt.absentToday)} link="/attendance" />
            <StatCard color="amber" label="قرارداد‌های رو به انقضا (۳۰ روز)" value={toPersianDigits(mgmt.expiringContracts)} link="/contracts" />
          </div>

          <div className="grid grid-3 mb">
            <Card title="در انتظار تصمیم شما و همکاران">
              <div className="col" style={{ gap: 10 }}>
                <PendingRow label="درخواست مرخصی" count={mgmt.pending.leaves} link="/approvals" />
                <PendingRow label="اصلاح کارت حضور" count={mgmt.pending.corrections} link="/approvals" />
                <PendingRow label="مأموریت" count={mgmt.pending.missions} link="/approvals" />
                <PendingRow label="تعویض شیفت" count={mgmt.pending.swaps} link="/approvals" />
                <PendingRow label="وام و مساعده" count={mgmt.pending.loans} link="/loans" />
              </div>
            </Card>

            <Card title="توزیع نیروها بر اساس وضعیت">
              <div className="chart-box">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: 'inherit' }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip formatter={(v: number) => toPersianDigits(v)} />
                    <Bar dataKey="count" fill="#2563eb" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title="حضور ماه جاری">
              <div className="col" style={{ gap: 12 }}>
                <div className="flex-between">
                  <span className="text-muted text-sm">رکوردهای ثبت‌شده</span>
                  <span className="fw-700">{toPersianDigits(mgmt.monthAttendance.records)}</span>
                </div>
                <div className="flex-between">
                  <span className="text-muted text-sm">کارکرد</span>
                  <span className="fw-700">{fmtMinutes(mgmt.monthAttendance.workMinutes)}</span>
                </div>
                <div className="flex-between">
                  <span className="text-muted text-sm">اضافه‌کاری</span>
                  <Badge kind="green">{fmtMinutes(mgmt.monthAttendance.overtimeMinutes)}</Badge>
                </div>
                <div className="flex-between">
                  <span className="text-muted text-sm">تأخیر</span>
                  <Badge kind="red">{fmtMinutes(mgmt.monthAttendance.lateMinutes)}</Badge>
                </div>
                <div className="flex-between">
                  <span className="text-muted text-sm">وظایف باز سازمان</span>
                  <Badge kind="blue">{toPersianDigits(mgmt.openTasks)}</Badge>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}

      {loading && <div className="skeleton" style={{ height: 120 }} />}
    </>
  );
}

function StatCard({ color, label, value, link }: { color: string; label: string; value: string; link: string }) {
  return (
    <Link to={link} style={{ textDecoration: 'none' }}>
      <div className="stat-card">
        <div className={`stat-icon ${color}`}>📈</div>
        <div>
          <div className="stat-value">{value}</div>
          <div className="stat-label">{label}</div>
        </div>
      </div>
    </Link>
  );
}

function PendingRow({ label, count, link }: { label: string; count: number; link: string }) {
  return (
    <Link to={link} className="flex-between" style={{ textDecoration: 'none' }}>
      <span className="text-sm">{label}</span>
      <Badge kind={count > 0 ? 'amber' : 'gray'}>{toPersianDigits(count)}</Badge>
    </Link>
  );
}
