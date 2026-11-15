# HRMS UI Design System

## Scope

The existing React, Vite, TypeScript and REST architecture is retained. All 28
authenticated destinations share the same shell, typography, controls and states.
The employee screen still opens directly on tasks without task search or paging.

## Styles

Load order: `global.css`, `tokens.css`, `shell.css`, `controls.css`, `workspace.css`.
The legacy stylesheet retains domain layouts; the following files establish the
new component contracts. Theme colors, borders, spacing and surface levels live
in `tokens.css`. Dark is the default; an explicit light preference persists.
Vazirmatn is served locally with its OFL license, without a third-party font call.

Page sections are unframed. Tables, repeated task items and dialogs have bounded
surfaces. The primary button color is slightly darker than the suggested blue to
improve white-text contrast. Text and icon focus states work in both themes.

## Components

- `ui.tsx`: public component exports. `ui/base.tsx` contains labelled fields,
  inputs, buttons, tabs, pagination and notifications, without circular imports.
- `ui/DataTable.tsx`: loading, error/retry, empty state and stable local-page sort.
  Sorting is explicitly limited to the current server page, not the full dataset.
- `ui/Modal.tsx`: portal, focus trap, Escape, nested-dialog stack and focus return.
- `ui/DatePicker.tsx`: Jalali calendar using the existing `jalaali-js` dependency;
  manual date entry and existing ISO/Jalali field contracts are retained.
- `ui/EntityPicker.tsx`: searchable server-paginated employee/type selectors,
  with the previous ID-entry option retained as a fallback.
- `GlobalSearch.tsx`: permission-filtered navigation and real resource search.
  The documents API has no text search, so the frontend searches its scoped pages
  before paginating matches. Large document collections can cost extra requests.

The sidebar becomes a modal drawer below 1024px. Desktop collapse is persistent;
tables and Gantt surfaces scroll internally instead of widening the page.

## Attendance Policy

Login is no longer attendance. The header only displays Tehran date/time. The
employee panel has no attendance tab, status badge or project check-in controls.
The attendance management menu and page are also hidden from non-managers.
The legacy project check-in write route now also requires manager and attendance
write permissions; changing only the UI is not relied on for authorization.

`PATCH /attendance/daily/:employeeId` records today's present/absent status and an
optional arrival time/note. It requires both `dashboard.view.management` and
`attendance.create`, enforces employee scope and company-local day boundaries,
and writes an audit record in the same transaction. Locked or calculated records
must use the existing correction workflow. A present mark does not invent a full
day of work or payroll minutes. Device attendance and approved leave/mission
records remain supported. Previous records are not deleted or rewritten.

## Verification

- Frontend: `npm test`, `npx tsc --noEmit`, `npm run build`.
- Backend: `npm test -- --runInBand`, `npm run build`.
- Browser: every authenticated destination opened on desktop and 390px mobile;
  shared search/sort/page size, nested picker, calendar, themes and task flows
  checked separately. Desktop/tablet/mobile sizing and console errors inspected.
- Test-only accounts and tasks are removed after browser verification. Real HR,
  payroll and contract actions are not submitted merely to test their appearance.

This is local development verification, not a production accessibility audit or
an exhaustive end-to-end test of every business workflow.
