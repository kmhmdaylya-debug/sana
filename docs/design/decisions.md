# Design Decisions - Sana HRMS

**Purpose**: Document rationale for visual and UX changes
**Last Updated**: 2026-11-18

---

## Decision Template

Each decision follows this format:
- **Decision**: What was changed
- **Context**: Why the change was needed
- **Options Considered**: Alternatives evaluated
- **Rationale**: Why the chosen option was selected
- **Impact**: Expected user/developer impact
- **Status**: Proposed / Approved / Implemented / Rejected

---

## D-001: Standardize on 4px Base Spacing Unit

**Decision**: Adopt 4px (0.25rem) as the base spacing unit; all spacing values are multiples of 4px.

**Context**: Current implementation uses inconsistent spacing (12px, 14px, 16px, 18px, 20px, 24px, etc.) leading to visual inconsistency.

**Options Considered**:
1. 8px base unit (Material Design)
2. 4px base unit (Tailwind, modern systems)
3. Keep current inconsistent values

**Rationale**: 4px provides finer granularity for dense enterprise UI while maintaining rhythm. Matches Tailwind's scale which developers are familiar with. Allows 12px, 16px, 20px, 24px, 28px, 32px - all useful for different component densities.

**Impact**: 
- Consistent visual rhythm across all components
- Easier developer decisions (no arbitrary pixel values)
- Better RTL support (logical properties align to grid)

**Status**: Proposed - needs implementation across all components

---

## D-002: Semantic Color Token System

**Decision**: Replace all hardcoded colors with semantic tokens (--color-primary-600, --color-error-600, etc.)

**Context**: Current codebase uses mixed approaches: some CSS variables, some hardcoded hex, some Tailwind classes. Dark theme support is incomplete.

**Options Considered**:
1. Keep Tailwind color classes everywhere
2. CSS custom properties with semantic names
3. CSS-in-JS with theme object

**Rationale**: Semantic tokens (--color-primary-600) express intent ("primary action") not implementation ("blue-600"). Enables theming, dark mode, and high-contrast mode without component changes. CSS custom properties work with both CSS and CSS-in-JS.

**Impact**:
- Complete dark mode support
- High-contrast mode via media query
- Brand changes only in token file
- Accessibility compliance easier

**Status**: Proposed - tokens defined in tokens.md, needs migration

---

## D-003: Persian-First Typography with Vazirmatn

**Decision**: Use Vazirmatn as primary font with Inter fallback for Latin; font sizes follow 1.125 ratio scale.

**Context**: Current implementation uses Vazirmatn but with inconsistent sizes (13px, 14px, 15px, 16px, 18px). Latin fallback not specified.

**Options Considered**:
1. Keep Vazirmatn only
2. Vazirmatn + Inter fallback (recommended)
3. System font stack only

**Rationale**: Vazirmatn is optimized for Persian but lacks full Latin glyph coverage. Inter provides excellent Latin readability and matches Vazirmatn's geometric style. 1.125 ratio (12, 14, 16, 18, 20, 22.5, 25.3...) creates harmonious scale.

**Impact**:
- Consistent Persian/Latin readability
- Predictable type scale
- Better RTL text rendering

**Status**: Proposed - Vazirmatn already used, needs scale enforcement

---

## D-004: RTL Logical Properties Throughout

**Decision**: Use CSS logical properties (margin-inline-start, padding-inline-end) instead of physical (margin-left, padding-right).

**Context**: Current codebase mixes physical and logical properties. Some components break in RTL due to hardcoded left/right.

**Options Considered**:
1. Physical properties with [dir="rtl"] overrides
2. Logical properties everywhere
3. CSS-in-JS with RTL-aware utilities

**Rationale**: Logical properties are the modern standard for internationalization. Single codebase works for LTR and RTL without overrides. Browser support is excellent (all modern browsers). Reduces RTL-specific bugs.

**Impact**:
- Zero RTL-specific CSS needed
- Future LTR support trivial
- Cleaner, more maintainable styles

**Status**: Proposed - needs audit and migration

---

## D-005: Component Variant System (Primary/Secondary/Ghost/Destructive)

**Decision**: Standardize button/input/card variants: Primary, Secondary, Ghost, Destructive, Outline.

**Context**: Current components have inconsistent variant names and behaviors. Some use "default", "primary", "danger"; others use "solid", "outline", "ghost".

**Options Considered**:
1. Tailwind-style: primary, secondary, outline, ghost, link
2. Material-style: contained, outlined, text, elevated
3. Custom: primary, secondary, ghost, destructive, outline

**Rationale**: Custom set maps to our semantic colors (primary, error, secondary). "Destructive" is clearer than "danger" for Persian UI. "Ghost" is standard for low-emphasis actions. Covers all use cases in HRMS.

**Impact**:
- Consistent action hierarchy across app
- Clear affordance for users
- Easier component composition

**Status**: Proposed - needs component library update

---

## D-006: Focus Visible for Keyboard Navigation

**Decision**: Implement :focus-visible with 3px ring for all interactive elements; never remove focus styles.

**Context**: Current focus styles are inconsistent - some use outline, some box-shadow, some none. Keyboard users lose focus in modals, dropdowns.

**Options Considered**:
1. :focus with outline (always visible)
2. :focus-visible with ring (keyboard only)
3. Custom focus management with tabindex

**Rationale**: :focus-visible shows focus only for keyboard users (not mouse clicks), reducing visual noise. 3px ring with offset meets WCAG 2.4.7. Never removing focus ensures accessibility compliance.

**Impact**:
- WCAG 2.4.7 compliance
- Better keyboard UX
- Consistent focus across all components

**Status**: Proposed - needs implementation on all interactive elements

---

## D-007: Persian Number Formatting

**Decision**: Display Persian digits (۰-۹) in all user-facing numbers; store/process Latin digits (0-9) in code.

**Context**: Current implementation mixes Persian and Latin digits. Some inputs show Latin, some Persian. Code sometimes parses Persian digits causing bugs.

**Options Considered**:
1. Persian digits everywhere (display + code)
2. Latin digits everywhere
3. Display Persian, process Latin (recommended)

**Rationale**: Users expect Persian digits in Persian UI. Code/DB/API should use Latin for consistency, sorting, calculation. Conversion at display layer only. Input fields should accept both but normalize to Latin.

**Impact**:
- Correct Persian UX
- No parsing bugs in backend
- Consistent data storage

**Status**: Proposed - needs Intl.NumberFormat integration

---

## D-008: Jalali Date Display with Gregorian Storage

**Decision**: Display all dates in Jalali (Persian calendar); store/transmit in Gregorian ISO 8601.

**Context**: Current implementation uses Jalali in UI but some API endpoints expect/return Jalali strings causing sorting/filtering bugs.

**Options Considered**:
1. Jalali everywhere
2. Gregorian everywhere
3. Display Jalali, store Gregorian (recommended)

**Rationale**: Users need Jalali. Databases/sorting/APIs work correctly with Gregorian. Conversion at presentation layer only. Sorting uses stored Gregorian value, not display string.

**Impact**:
- Correct date sorting/filtering
- No API contract issues
- Consistent with international standards

**Status**: Proposed - needs date-fns-jalali integration

---

## D-009: Consistent Icon System (Lucide + Custom)

**Decision**: Use Lucide React for standard icons; custom SVG for domain-specific icons; all icons 20px default, 16px small, 24px large.

**Context**: Current codebase uses mixed icon libraries (Lucide, Heroicons, custom SVG). Sizes inconsistent (16px, 17px, 18px, 19px, 20px, 24px).

**Options Considered**:
1. Single library (Lucide)
2. Lucide + custom for domain
3. Icon font (FontAwesome)

**Rationale**: Lucide has excellent coverage, tree-shakeable, consistent stroke width (2px). Custom SVG for HR-specific icons (contract, payslip, shift). 20px default matches 16px text baseline. 4px increments for size variants.

**Impact**:
- Consistent visual language
- Smaller bundle (tree-shaking)
- RTL mirroring via CSS transform

**Status**: Proposed - Lucide already used, needs size standardization

---

## D-010: Toast/Notification System Standardization

**Decision**: Single toast system with 4 types (success, error, warning, info); auto-dismiss after 5s; max 3 visible; persist on hover.

**Context**: Current implementation has multiple notification patterns: inline alerts, toasts, modal alerts, banner alerts. No consistent timing or positioning.

**Options Considered**:
1. Top-right toast stack (standard)
2. Bottom-center snackbars (Material)
3. Inline alerts only
4. Toast stack + inline for forms

**Rationale**: Top-right stack is most familiar pattern. 5s auto-dismiss with hover pause balances visibility and non-intrusiveness. Max 3 prevents screen flooding. Inline alerts for form validation errors.

**Impact**:
- Predictable notification UX
- No missed critical messages
- Reduced cognitive load

**Status**: Proposed - needs unified notification context

---

## D-011: Form Field Layout (Label + Input + Help + Error)

**Decision**: Standard form field structure: Label (required) → Input → Help text → Error message; all associated via aria-describedby.

**Context**: Current forms have inconsistent label placement (some above, some left), missing help text, errors not linked to inputs.

**Options Considered**:
1. Label above (vertical stack)
2. Label left (horizontal)
3. Floating label (Material)
4. Label above with help/error below (recommended)

**Rationale**: Vertical stack works best for RTL Persian (long labels). Help text provides context without clutter. Error linked via aria-describedby ensures screen reader announcement. Required indicator on label.

**Impact**:
- WCAG 3.3.2 compliance (labels)
- Better form completion rates
- Consistent across all forms

**Status**: Proposed - needs form component update

---

## D-012: Table Density Options (Comfortable/Compact)

**Decision**: Two table densities: Comfortable (12px cell padding, 16px row height) and Compact (8px cell padding, 12px row height); user preference persisted.

**Context**: Current tables use single density (mixed 12px/16px). Data-heavy pages (5000+ employees) need compact mode; detail pages need comfortable.

**Options Considered**:
1. Single density
2. Two densities (comfortable/compact)
3. Three densities (comfortable/normal/compact)
4. Continuous slider

**Rationale**: Two densities cover 95% of use cases. Comfortable for reading/scanning; Compact for data density. User preference in localStorage. No JavaScript layout shift.

**Impact**:
- Better data scanning for power users
- Improved readability for casual users
- Accessibility (larger tap targets in comfortable)

**Status**: Proposed - needs table component update

---

## D-013: Empty State Pattern (Illustration + Message + Action)

**Decision**: Standard empty state: Illustration → Title → Description → Primary Action Button; all in Persian.

**Context**: Current empty states are inconsistent: some show "No data", some show nothing, some show generic spinner.

**Options Considered**:
1. Text only ("هیچ داده‌ای یافت نشد")
2. Illustration + text
3. Illustration + text + action (recommended)
4. Full-page illustration

**Rationale**: Action-oriented empty states guide users to next step. Illustration provides visual interest. Persian copy ensures clarity. Consistent across all list pages.

**Impact**:
- Reduced user confusion
- Clear next steps
- Brand personality

**Status**: Proposed - needs empty state component

---

## D-014: Confirmation Dialog for Destructive Actions

**Decision**: Destructive actions require confirmation dialog with object name: "آیا از حذف «قرارداد شماره ۱۲۳» مطمئن هستید؟" with "حذف" (destructive) and "انصراف" buttons.

**Context**: Current confirmations use generic "آیا مطمئن هستید؟" without object context. Some destructive actions have no confirmation.

**Options Considered**:
1. Generic confirmation
2. Object-specific confirmation (recommended)
3. Undo toast instead of confirmation
4. Two-step (click → confirm button appears)

**Rationale**: Object-specific confirmation prevents accidental deletions. Persian phrasing is natural. Destructive button styling (red) signals danger. Unwraps "حذف" (delete) vs "انصراف" (cancel) clear.

**Impact**:
- Fewer accidental deletions
- Clearer user intent
- Audit trail clarity

**Status**: Proposed - needs confirmation dialog component

---

## D-015: Loading States (Skeleton vs Spinner)

**Decision**: Use skeleton loaders for list/table content; spinner for full-page loads; button loading state for actions.

**Context**: Current loading patterns inconsistent: some show spinners, some show nothing, some show skeleton but wrong shape.

**Options Considered**:
1. Spinners everywhere
2. Skeletons everywhere
3. Context-appropriate (recommended)

**Rationale**: Skeletons reduce perceived latency for content areas. Spinners appropriate for full-page navigation. Button loading prevents double-clicks. Skeleton shape should match content (text lines, avatar, table rows).

**Impact**:
- Better perceived performance
- Reduced layout shift
- Professional feel

**Status**: Proposed - needs skeleton components

---

## D-016: Responsive Breakpoints (Mobile-First)

**Decision**: Breakpoints: 375px (mobile), 768px (tablet), 1024px (desktop), 1280px (large). Mobile-first CSS.

**Context**: Current breakpoints inconsistent. Some components use 768px, others 992px, others 1024px. No mobile-first approach.

**Options Considered**:
1. Tailwind defaults (640, 768, 1024, 1280)
2. Custom (375, 768, 1024, 1280)
3. Container queries only

**Rationale**: 375px matches iPhone SE / common mobile. 768px tablet portrait. 1024px desktop. 1280px large. Mobile-first reduces CSS payload for mobile. Matches design mockups.

**Impact**:
- Consistent responsive behavior
- Mobile performance optimized
- Design-dev alignment

**Status**: Proposed - needs breakpoint audit

---

## D-017: Modal/Drawer Pattern

**Decision**: Modals for focused tasks (< 50% screen); Drawers for complex forms/side panels (> 50% screen); both trap focus, close on Escape/backdrop click.

**Context**: Current implementation mixes modals, drawers, and full-page navigation inconsistently. Focus management missing.

**Options Considered**:
1. Modals only
2. Drawers only
3. Context-based (recommended)

**Rationale**: Modals for quick confirmations/simple forms. Drawers for multi-step wizards, filters, detail panels. Both need focus trap, ARIA roles, and proper close handling. Mobile: drawers become bottom sheets.

**Impact**:
- Consistent overlay UX
- Accessibility compliance
- Mobile-friendly

**Status**: Proposed - needs overlay primitives

---

## D-018: Avatar System (User/Entity)

**Decision**: Avatar sizes: 24px (xs), 32px (sm), 40px (md), 56px (lg), 80px (xl); fallback: initials in Persian; color from hash of name.

**Context**: Current avatars inconsistent sizes (28px, 36px, 44px, 52px). No fallback for users without photos.

**Options Considered**:
1. Single size
2. 4 sizes
3. 5 sizes with hash-based color (recommended)

**Rationale**: 5 sizes cover all use cases. Hash-based color provides visual distinction without storage. Persian initials (first letter of first/last name) for RTL. 8px increments for consistency.

**Impact**:
- Consistent identity representation
- No broken image placeholders
- Visual scanning improvement

**Status**: Proposed - needs avatar component

---

## D-019: Badge/Tag System

**Decision**: Badge variants: Default (gray), Primary (blue), Success (green), Warning (amber), Error (red), Info (blue); sizes: sm (10px text), md (12px text); removable variant for filters.

**Context**: Current badges inconsistent colors/sizes. Some use Tailwind classes, some custom CSS.

**Options Considered**:
1. Semantic variants only
2. Color palette variants
3. Semantic + removable (recommended)

**Rationale**: Semantic variants map to meaning (error=red, success=green). Removable variant for filter chips. 2 sizes cover inline (sm) and standalone (md). Rounded-full for pill shape.

**Impact**:
- Consistent status indication
- Filter UX improvement
- Visual hierarchy

**Status**: Proposed - needs badge component

---

## D-020: Tooltip Pattern

**Decision**: Tooltips for icon-only buttons and truncated text; 200ms show delay, 100ms hide; position: top (default), bottom, left, right; arrow pointing to trigger.

**Context**: Current tooltips missing on many icon buttons. Some use title attribute (not accessible), some custom.

**Options Considered**:
1. Native title attribute
2. Custom tooltip component (recommended)
3. Tippy.js / Floating UI

**Rationale**: Custom component ensures RTL positioning, keyboard accessibility, and consistent styling. 200ms delay prevents flicker. Arrow provides visual connection. Works with keyboard focus.

**Impact**:
- Better discoverability
- Accessibility compliance
- RTL-safe positioning

**Status**: Proposed - needs tooltip primitive

---

## Summary

| Decision | Priority | Effort | Dependencies |
|----------|----------|--------|--------------|
| D-001 Spacing | High | Medium | None |
| D-002 Color Tokens | High | High | D-001 |
| D-003 Typography | High | Medium | None |
| D-004 RTL Logical | High | High | None |
| D-005 Variants | Medium | Medium | D-002 |
| D-006 Focus Visible | High | Low | None |
| D-007 Persian Numbers | High | Medium | None |
| D-008 Jalali Dates | High | Medium | None |
| D-009 Icons | Medium | Low | None |
| D-010 Toasts | Medium | Medium | D-002 |
| D-011 Forms | High | High | D-001, D-004 |
| D-012 Tables | Medium | Medium | D-001 |
| D-013 Empty States | Medium | Low | D-009 |
| D-014 Confirmations | High | Medium | D-005 |
| D-015 Loading | Medium | Medium | D-009 |
| D-016 Breakpoints | Medium | Low | D-001 |
| D-017 Modals/Drawers | High | High | D-002, D-004 |
| D-018 Avatars | Low | Low | D-009 |
| D-019 Badges | Low | Low | D-002 |
| D-020 Tooltips | Medium | Medium | D-004 |

**Total**: 20 decisions, 8 High priority, 8 Medium, 4 Low

**Implementation Order**: D-001, D-002, D-003, D-004, D-006, D-007, D-008 → D-005, D-010, D-011, D-014, D-017 → D-009, D-012, D-013, D-015, D-016, D-019, D-020 → D-018

---

*Each decision should be reviewed by Product, Design, and Engineering before implementation.*