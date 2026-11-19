# Sana HRMS - Navigation and Role-Based UX Audit

**Version:** 1.0  
**Date:** 2026-11-18  
**Auditor:** Senior UX Engineer  
**Classification:** INTERNAL  

---

## 1. Overview

This audit evaluates navigation structure, role-based access, and user experience across different user roles in Sana HRMS.

---

## 1. Role Definitions & Permissions

### 1.1 Implemented Roles

| Role | Key Permissions | Description |
|------|-----------------|-------------|
| **Superadmin** | All permissions | System administrator |
| **HR Manager** | `employees.*`, `contracts.*`, `payroll.*`, `leaves.approve`, `org.*` | HR leadership |
| **Department Manager** | `dashboard.view.management`, `approvals.view`, `attendance.view` (team), `leaves.approve` (team) | Department head |
| **Employee** | `panel.view`, `leaves.create`, `attendance.view.own`, `documents.view.own` | Regular employee |
| **Payroll Admin** | `payroll.*`, `loans.*`, `reports.view` | Payroll specialist |
| **Recruiter** | `recruitment.*`, `documents.view` | Hiring team |
| **Auditor** | `audit.view`, `reports.view` | Compliance |

---

## 2. Navigation Structure

### 1.1 Sidebar Navigation Groups

| Group | Items | Permission Logic |
|-------|-------|------------------|
| **اصلی (Main)** | Panel, Dashboard, Approvals | `panel.view`, `dashboard.view.management`, `approvals.view` |
| **منابع انسانی (HR)** | Users, Contracts, Documents, Attendance, Shifts, Leaves, Missions, Payroll, Evaluations | Various `*.view` permissions |
| **همکاری و پشتیبانی (Collaboration)** | Tasks, Projects, Assets, Training, Loans | Various `*.view` permissions |
| **جذب و چرخه عمر (Recruitment/Lifecycle)** | Recruitment, Lifecycle | `recruitment.view`, `lifecycle.view` |
| **امور اداری (Admin)** | Admin, Announcements, Notifications | `admin.view`, `announcements.view`, `notifications.view` |
| **گزارش و سیستم (Reports & System)** | Reports, Roles, Org, Audit, Settings, Backup | `reports.view`, `roles.view`, `org.view`, `audit.view`, `settings.view`, `backup.manage` |

### 2.2 Menu Filtering Logic

```typescript
// Layout.tsx - Menu filtering
const visibleMenu = MENU.map(g => ({
  ...g,
  items: g.items.filter(i => 
    (!i.permission || hasPermission(i.permission)) &&
    (!i.requiresEmployee || !!user?.employee) &&
    (!i.requiresManagement || hasPermission('dashboard.view.management'))
  ).map(i => i.to === '/approvals' ? { ...i, count: pendingApprovals } : i),
})).filter(g => g.items.length > 0);
```

---

## 3. Role-Based Visibility Matrix

| Route | Employee | Manager | HR Manager | Payroll Admin | Superadmin |
|-------|----------|---------|------------|---------------|------------|
| `/panel` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/approvals` | ❌ | ✅ | ✅ | ❌ | ✅ |
| `/employees` | ❌ | ✅ (team) | ✅ | ❌ | ✅ |
| `/employees/:id` | Own only | Team | ✅ | ❌ | ✅ |
| `/contracts` | ❌ | ✅ (team) | ✅ | ❌ | ✅ |
| `/documents` | Own only | Team | ✅ | ❌ | ✅ |
| `/attendance` | Own only | Team | ✅ | ❌ | ✅ |
| `/shifts` | ❌ | ✅ | ✅ | ❌ | ✅ |
| `/leaves` | Own + create | Team + approve | ✅ | ❌ | ✅ |
| `/missions` | Own + create | Team + approve | ✅ | ❌ | ✅ |
| `/payroll` | Own payslip | ❌ | ✅ | ✅ | ✅ |
| `/evaluations` | Own | Team | ✅ | ❌ | ✅ |
| `/tasks` | Own + assigned | Team + created | ✅ | ❌ | ✅ |
| `/projects` | Member + owned | Team + owned | ✅ | ❌ | ✅ |
| `/assets` | Assigned | Team | ✅ | ❌ | ✅ |
| `/training` | Own records | Team | ✅ | ❌ | ✅ |
| `/loans` | Own + create | Team + approve | ✅ | ❌ | ✅ |
| `/recruitment` | ❌ | ✅ | ✅ | ❌ | ✅ |
| `/lifecycle` | ❌ | ✅ (team) | ✅ | ❌ | ✅ |
| `/admin` | ❌ | ❌ | ✅ | ❌ | ✅ |
| `/announcements` | View | View | ✅ | ❌ | ✅ |
| `/notifications` | Own | Own | ✅ | Own | ✅ |
| `/reports` | ❌ | ✅ (dept) | ✅ | ✅ | ✅ |
| `/users` | ❌ | ❌ | ✅ | ❌ | ✅ |
| `/roles` | ❌ | ❌ | ✅ | ❌ | ✅ |
| `/org` | ❌ | ✅ (dept) | ✅ | ❌ | ✅ |
| `/audit` | ❌ | ❌ | ✅ | ❌ | ✅ |
| `/settings` | ❌ | ❌ | ✅ | ❌ | ✅ |
| `/backup` | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 3. Navigation Components

### 3.1 Sidebar Navigation

| Feature | Implementation | Status |
|---------|----------------|--------|
| Collapsible | localStorage + CSS | ✅ |
| Mobile Drawer | ✅ | ✅ |
| Backdrop | ✅ | ✅ |
| Keyboard Trap | ✅ | ✅ |
| Focus Management | ✅ | ✅ |
| Group Collapse | localStorage | ✅ |
| Permission Filtering | Real-time | ✅ |
| Badge Counts | Real-time | ✅ |

### 3.2 Header

| Element | Behavior |
|---------|----------|
| Logo | Links to home |
| Breadcrumb | Group > Page |
| Global Search | Ctrl+K, modal |
| Theme Toggle | Dark/Light |
| Notifications | Badge + dropdown |
| Profile Menu | Profile, Settings, Logout |

### 3.3 Mobile Navigation

| Feature | Implementation |
|---------|----------------|
| Hamburger Menu | ✅ |
| Drawer Animation | ✅ |
| Backdrop Close | ✅ |
| Touch Targets | ≥44px |
| Swipe to Close | ❌ Not implemented |

---

## 4. Role-Specific UX

### 4.1 Employee (Self-Service)

| Feature | Access |
|---------|--------|
| Panel (`/panel`) | ✅ 6 tabs |
| Own Attendance | ✅ |
| Own Leaves | ✅ Create + View |
| Own Documents | ✅ |
| Own Payroll | ✅ Payslips |
| Own Tasks | ✅ Kanban |
| Own Missions | ✅ |
| Own Loans | ✅ |
| Profile | ✅ |

### 4.2 Manager

| Feature | Access |
|---------|--------|
| Team Attendance | ✅ Daily |
| Team Leaves | ✅ Approve |
| Team Tasks | ✅ Assign + View |
| Team Missions | ✅ Approve |
| Team Documents | ✅ View |
| Team Payroll | ❌ (Payroll admin only) |

### 4.3 HR Manager

| Feature | Access |
|---------|--------|
| All Employees | ✅ CRUD |
| Contracts | ✅ Full |
| All Leaves | ✅ Approve all |
| Payroll | ✅ Full cycle |
| Reports | ✅ All |
| Settings | ✅ |

### 4.4 Payroll Admin

| Feature | Access |
|---------|--------|
| Payroll Periods | ✅ Full |
| Payslips | ✅ Generate, publish |
| Reports | ✅ Payroll only |
| Loans | ✅ Approve |
| Settings | Payroll only |

---

## 4. Navigation Usability

### 4.1 Discoverability

| Aspect | Status |
|---------|--------|
| Menu Labels | Clear Persian labels |
| Icons | Lucide icons, consistent |
| Tooltips | Collapsed sidebar shows labels |
| Search | Global Ctrl+K |
| Breadcrumb | Group > Page |
| Active State | Visual + aria-current |

### 4.2 Mobile Navigation

| Feature | Status |
|---------|--------|
| Hamburger Menu | ✅ |
| Drawer Animation | ✅ |
| Backdrop Close | ✅ |
| Touch Targets | ≥44px |
| Swipe to Close | ❌ Not implemented |

---

## 5. Accessibility

### 5.1 Navigation Accessibility

| Feature | Status |
|---------|--------|
| Skip Link | ✅ "رفتن به محتوای اصلی" |
| ARIA Labels | ✅ All nav elements |
| Focus Visible | ✅ |
| Keyboard Nav | ✅ Arrow keys, Enter, Escape |
| ARIA Expanded | ✅ Collapsible groups |
| ARIA Current | ✅ Active page |

### 4.2 Role-Based Redirects

| Scenario | Behavior |
|----------|----------|
| Employee accesses `/` | Redirect to `/panel` |
| Manager accesses `/` | Dashboard management view |
| Unauthorized route | 403 with message |
| No permission | Hidden from menu |

---

## 5. Search & Discovery

| Feature | Implementation |
|---------|----------------|
| Global Search | Ctrl+K modal |
| Entity Picker | Reusable component |
| Recent Items | Not implemented |
| Bookmarks | Not implemented |

---

## 6. Findings & Recommendations

### High Priority

| Issue | Impact | Fix |
|-------|--------|-----|
| Mobile swipe-to-close sidebar | Missing UX pattern | Add touch events |
| Search hidden on mobile | Reduced discoverability | Add search icon button |
| No recent items in search | Reduced efficiency | Add recent items |

### Medium Priority

| Issue | Impact | Fix |
|-------|--------|-----|
| No breadcrumb on mobile | Orientation | Show on mobile |
| No keyboard shortcut hints | Power users | Add help modal |
| No recent items in profile menu | Efficiency | Add to profile dropdown |

### Low Priority

| Issue | Impact |
|-------|--------|
| No keyboard shortcut hints | Power users |
| No recent items in profile menu | Efficiency |

---

## 7. Role-Based Redirects

| Scenario | Behavior |
|----------|----------|
| Employee accesses `/` | Redirect to `/panel` |
| Manager accesses `/` | Management dashboard |
| Unauthorized route | 403 with Persian message |
| No permission | Hidden from menu |

---

## 8. Test Results

| Test | Status |
|-------|--------|
| Role-based menu filtering | ✅ Pass |
| Employee redirect to panel | ✅ Pass |
| Manager dashboard access | ✅ Pass |
| HR full access | ✅ Pass |
| Superadmin full access | ✅ Pass |
| Unauthorized access blocked | ✅ Pass |
| Mobile sidebar | ✅ Pass |
| Breadcrumb accuracy | ✅ Pass |

---

## 8. Recommendations

1. **Add swipe-to-close on mobile sidebar** - Standard mobile pattern
2. **Add search icon button on mobile header** - Search discoverability
3. **Add recent items to global search** - Efficiency
4. **Add keyboard shortcut help modal** - Power users
5. **Implement swipe-to-close on mobile** - Mobile UX
6. **Add breadcrumb on mobile** - Orientation

---

**Document Version:** 1.0  
**Date:** 2026-11-18  
**Status:** Complete  
**Classification:** INTERNAL