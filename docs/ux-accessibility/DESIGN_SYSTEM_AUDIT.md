# Sana HRMS - Design System Audit

**Version:** 1.0  
**Date:** 2026-11-18  
**Auditor:** Senior UI/UX Engineer  
**Classification:** INTERNAL  

---

## 1. Overview

This audit evaluates the design system implementation in Sana HRMS, including color palette, typography, spacing, components, and design tokens.

---

## 2. Color Palette

### 1.1 Dark Mode (Default)

| Token | Value | Usage | Contrast (Dark) |
|-------|-------|-------|-----------------|
| `--bg` | `#080909` | Page background | - |
| `--sidebar-bg` | `#080909` | Sidebar background | - |
| `--surface` | `#151716` | Card/panel background | - |
| `--surface-2` | `#222523` | Elevated surfaces | - |
| `--surface-hover` | `#292d2a` | Hover states | - |
| `--input-bg` | `#1b1e1c` | Input backgrounds | - |
| `--border` | `#303631` | Default borders | 3.2:1 |
| `--border-strong` | `#505a52` | Strong borders | 5.1:1 |
| `--text` | `#f5f6f3` | Primary text | 16.8:1 |
| `--text-muted` | `#b6bdb6` | Secondary text | 7.2:1 |
| `--text-soft` | `#929d93` | Tertiary text | 4.8:1 |
| `--primary` | `#b2cfb7` | Primary brand | 8.1:1 (on dark) |
| `--primary-hover` | `#c5ddc8` | Primary hover | 9.1:1 |
| `--on-primary` | `#142019` | Text on primary | 8.1:1 |
| `--focus` | `rgba(178,207,183,.2)` | Focus rings | - |
| `--success-solid` | `#467952` | Success solid | 4.5:1 |
| `--success-hover` | `#3b6946` | Success hover | 3.8:1 |

### 2.2 Light Mode

| Token | Value | Usage | Contrast (Light) |
|-------|-------|-------|------------------|
| `--bg` | `#f3f5f2` | Page background | - |
| `--sidebar-bg` | `#ffffff` | Sidebar background | - |
| `--surface` | `#ffffff` | Card background | - |
| `--surface-2` | `#edf1ec` | Elevated surfaces | - |
| `--surface-hover` | `#e5ece3` | Hover states | - |
| `--input-bg` | `#ffffff` | Input backgrounds | - |
| `--border` | `#d5ded3` | Default borders | 2.8:1 ⚠️ |
| `--border-strong` | `#a7b5a5` | Strong borders | 4.1:1 |
| `--text` | `#20271f` | Primary text | 12.8:1 |
| `--text-muted` | `#53614f` | Secondary text | 4.8:1 |
| `--text-soft` | `#5f6c5b` | Tertiary text | 3.6:1 ⚠️ |
| `--primary` | `#365e40` | Primary brand | 7.2:1 |
| `--primary-hover` | `#294d33` | Primary hover | 5.8:1 |
| `--on-primary` | `#ffffff` | Text on primary | 7.2:1 |

**⚠️ Light Mode Issues:**
- `--border`: 2.8:1 (fails AA)
- `--text-soft`: 3.6:1 (fails AA)
- `--amber-600` on white: 3.2:1 (fails AA)
- `--red-600` on white: 3.8:1 (fails AA for large text)

---

## 2. Typography

### 2.1 Font Stack

```css
font-family: 'Vazirmatn', 'Segoe UI', Tahoma, 'Iranian Sans', system-ui, sans-serif;
```

| Weight | Availability | Usage |
|--------|--------------|-------|
| 100-900 (Variable) | ✅ WOFF2 | All weights available |
| Display | ✅ | Headings, hero |
| Body | ✅ | Paragraphs, UI text |
| Monospace | ❌ | Missing monospace variant |

### 2.2 Font Sizing Scale

| Size | Token | Value | Usage |
|------|-------|-------|-------|
| xs | --text-xs | 11.5px | Captions, metadata |
| sm | --text-sm | 12.5px | Labels, hints |
| base | - | 14px | Body text |
| lg | - | 15px | Subheadings |
| xl | - | 16px | Titles |
| 2xl | - | 18px | Section headers |
| 3xl | - | 22px | Card values |
| 4xl | - | 30px | Hero values |
| 5xl | - | 32px | Gauge numbers |

### 2.3 Font Weights

| Weight | CSS Value | Usage |
|--------|-----------|-------|
| 400 | Regular | Body text |
| 500 | Medium | Labels, buttons |
| 600 | Semibold | Headings, emphasis |
| 700 | Bold | Titles, values |
| 800 | Extrabold | Hero numbers |

---

## 3. Spacing System

### 3.1 Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | 4px | Tight gaps |
| `--space-2` | 8px | Default gaps |
| `--space-3` | 12px | Medium gaps |
| `--space-4` | 16px | Standard padding |
| `--space-5` | 20px | Section padding |
| `--space-6` | 24px | Large padding |
| `--space-8` | 32px | Section spacing |

### 3.2 Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 6px | Inputs, badges |
| `--radius` | 8px | Cards, modals |
| `999px` | - | Pills, badges, avatars |

### 3.3 Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,.08)` | Cards, inputs |
| `--shadow` | `0 5px 18px rgba(0,0,0,.12)` | Cards, dropdowns |
| `--shadow-lg` | `0 18px 60px rgba(0,0,0,.3)` | Modals, tooltips |

---

## 4. Component Library

### 4.1 Component Inventory

| Component | File | Variants | Status |
|-----------|------|----------|--------|
| Button | `base.tsx` | 5 variants, 2 sizes | ✅ Complete |
| Input | `base.tsx` | Text, password, email, etc. | ✅ Complete |
| Select | `base.tsx` | Native select | ✅ Complete |
| Textarea | `base.tsx` | Auto-resize | ✅ Complete |
| Field | `base.tsx` | Label, hint, error | ✅ Complete |
| Card | `base.tsx` | Header, body, actions | ✅ Complete |
| PageHeader | `base.tsx` | Title, subtitle, actions | ✅ Complete |
| Badge | `base.tsx` | 7 variants | ✅ Complete |
| Modal | `Modal.tsx` | Header, body, footer | ✅ Complete |
| DataTable | `DataTable.tsx` | Sort, paginate, actions | ✅ Complete |
| DatePicker | `DatePicker.tsx` | Jalali, RTL | ✅ Complete |
| Pagination | `base.tsx` | Page size, navigation | ✅ Complete |
| Tabs | `base.tsx` | Keyboard nav | ✅ Complete |
| Toast | `base.tsx` | 4 types, stack | ✅ Complete |
| ListToolbar | `base.tsx` | Search + filters | ✅ Complete |
| RequirePermission | `base.tsx` | RBAC wrapper | ✅ Complete |

### 4.2 Component Gaps

| Missing Component | Priority | Notes |
|-------------------|----------|-------|
| Accordion | Medium | Needed for FAQs, settings |
| Tooltip | Medium | Needed for dense UIs |
| Dropdown/Select (custom) | Medium | Native select limited |
| Radio Group | Low | Form consistency |
| Checkbox Group | Low | Form consistency |
| Switch/Toggle | Low | Settings pages |
| Slider/Range | Low | Filters, settings |
| Progress Bar | Low | Progress indication |
| Skeleton Variants | Low | More skeleton types |
| Avatar Group | Medium | User lists |
| Breadcrumb | Medium | Navigation |
| Divider | Low | Already in CSS |

---

## 4.3 Component Consistency Issues

| Component | Issue | Severity |
|-----------|-------|----------|
| Button | Missing `ghost` variant | Medium |
| Input | No `prefix`/`suffix` slots | Medium |
| Select | Native select limited styling | Medium |
| Modal | No `size` prop (sm/md/lg/full) | Medium |
| DataTable | No column resize | Medium |
| DataTable | No column visibility toggle | Medium |
| DatePicker | No range selection | Medium |
| Modal | No `initialFocus` prop | Low |
| Toast | No `duration` prop | Low |

---

## 5. Icon System

| Aspect | Status | Details |
|--------|--------|---------|
| Library | ✅ | `lucide-react` |
| Consistency | ✅ | All components use lucide |
| RTL Support | ✅ | Icons flip in RTL (ChevronLeft/Right) |
| Size Consistency | ✅ | 16px, 17px, 18px, 20px, 24px |
| Icon Colors | ✅ | Inherit `currentColor` |

---

## 5. Layout System

### 5.1 Grid System

| Class | Columns | Breakpoints |
|-------|---------|-------------|
| `.grid-2` | 2 | All |
| `.grid-3` | 3 | ≥768px |
| `.grid-4` | 4 | ≥768px |
| `.grid-6` | 6 | ≥1200px |
| `.grid-sidebar` | 2 | ≥960px |

### 5.2 Container

| Class | Max Width | Padding |
|-------|-----------|---------|
| `.app-content` | 1560px | 24px sides |

---

## 6. Responsive Breakpoints

| Breakpoint | Query | Layout Changes |
|------------|-------|----------------|
| ≥1200px | Desktop | Full sidebar, 6-col grid |
| 960-1199px | Laptop | Collapsible sidebar, 3-4 col |
| 768-959px | Tablet | Drawer sidebar, 2-3 col |
| 560-767px | Mobile Large | Drawer, 1-2 col |
| ≤560px | Mobile | Drawer, 1-col |

---

## 6. Motion & Animation

### 6.1 Transitions

| Token | Duration | Easing | Usage |
|-------|----------|--------|-------|
| `--transition` | 150ms | ease | Default |
| Modal | 160ms | ease-out | Modal enter |
| Toast | 180ms | ease-out | Toast enter |
| Shimmer | 1.4s | infinite | Skeletons |

### 6.2 Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## 7. Accessibility Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--focus` | `rgba(178,207,183,.2)` | Focus ring |
| `:focus-visible` | 2px solid primary | Keyboard focus |
| `--radius` | 8px | Interactive elements |
| `--radius-sm` | 6px | Small elements |

---

## 7. RTL Support Tokens

| Property | RTL Behavior |
|----------|--------------|
| `direction` | `rtl` on body |
| Flexbox | `row-reverse` where needed |
| Grid | RTL-aware |
| Margins/Padding | Logical properties preferred |
| Icons | ChevronLeft/Right swap in RTL |

---

## 8. Dark/Light Mode Switching

| Aspect | Implementation |
|--------|----------------|
| Storage | `localStorage` (key: `sana-theme`) |
| Default | Dark (`color-scheme: dark`) |
| Switch | Header toggle + Ctrl+K |
| Persistence | `localStorage` + `data-theme` attribute |
| Transition | 150ms ease |

---

## 9. Gaps & Recommendations

### 7.1 High Priority

| Gap | Impact | Effort |
|-----|--------|--------|
| Light mode contrast failures | High | Medium |
| Missing `ghost` button variant | Medium | Low |
| No column resize in DataTable | Medium | Medium |
| No column visibility toggle | Medium | Medium |
| DatePicker no range selection | Medium | Medium |

### 7.2 Medium Priority

| Gap | Impact | Effort |
|-----|--------|--------|
| Missing Accordion component | Medium | Low |
| Missing Tooltip component | Medium | Low |
| Missing Breadcrumb component | Medium | Low |
| Modal no size prop | Low | Low |
| Toast no duration prop | Low | Low |
| DatePicker no range selection | Medium | Medium |

### 7.3 Low Priority

| Gap | Impact | Effort |
|-----|--------|--------|
| Missing monospace font | Low | Low |
| Missing Accordion component | Low | Low |
| Missing Tooltip component | Low | Low |
| Missing Avatar Group | Low | Low |
| Missing Breadcrumb | Low | Low |

---

## 8. Token Usage Compliance

| Category | Compliance | Notes |
|----------|------------|-------|
| Colors | 95% | Minor hardcoded colors |
| Spacing | 100% | Consistent |
| Border Radius | 95% | Minor hardcoded |
| Shadows | 95% | Minor hardcoded |
| Typography | 90% | Some hardcoded sizes |
| Shadows | 95% | Minor hardcoded |

---

## 8. Recommendations

### Priority 1 (Immediate)
1. Fix light mode contrast failures
2. Add `ghost` button variant
2. Add DataTable column resize

### Priority 2 (Sprint 1)
1. Add DataTable column visibility toggle
2. Add DatePicker range selection
2. Add Modal size prop
2. Add Toast duration prop

### Priority 3 (Sprint 2)
1. Add Accordion component
2. Add Tooltip component
2. Add Breadcrumb component
2. Add Avatar Group component
2. Add Breadcrumb component

---

**Document Version:** 1.0  
**Date:** 2026-11-18  
**Status:** Complete  
**Classification:** INTERNAL