# Design Tokens - Sana HRMS

**Purpose**: Single source of truth for visual design tokens
**Last Updated**: 2026-11-18
**Status**: Derived from current implementation (CSS custom properties)

---

## Color Palette

### Primary (Brand)
```css
--color-primary-50: #eff6ff;
--color-primary-100: #dbeafe;
--color-primary-200: #bfdbfe;
--color-primary-300: #93c5fd;
--color-primary-400: #60a5fa;
--color-primary-500: #3b82f6;  /* Main brand */
--color-primary-600: #2563eb;  /* Primary actions */
--color-primary-700: #1d4ed8;
--color-primary-800: #1e40af;
--color-primary-900: #1e3a8a;
--color-primary-950: #172554;
```

### Secondary (UI)
```css
--color-secondary-50: #f8fafc;
--color-secondary-100: #f1f5f9;
--color-secondary-200: #e2e8f0;
--color-secondary-300: #cbd5e1;
--color-secondary-400: #94a3b8;
--color-secondary-500: #64748b;
--color-secondary-600: #475569;
--color-secondary-700: #334155;
--color-secondary-800: #1e293b;
--color-secondary-900: #0f172a;
--color-secondary-950: #020617;
```

### Semantic Colors

#### Success
```css
--color-success-50: #f0fdf4;
--color-success-100: #dcfce7;
--color-success-500: #22c55e;
--color-success-600: #16a34a;  /* Success actions */
--color-success-700: #15803d;
```

#### Warning
```css
--color-warning-50: #fffbeb;
--color-warning-100: #fef3c7;
--color-warning-500: #f59e0b;
--color-warning-600: #d97706;  /* Warning actions */
--color-warning-700: #b45309;
```

#### Error/Destructive
```css
--color-error-50: #fef2f2;
--color-error-100: #fee2e2;
--color-error-500: #ef4444;
--color-error-600: #dc2626;  /* Destructive actions */
--color-error-700: #b91c1c;
```

#### Info
```css
--color-info-50: #eff6ff;
--color-info-100: #dbeafe;
--color-info-500: #3b82f6;
--color-info-600: #2563eb;  /* Info actions */
--color-info-700: #1d4ed8;
```

### Neutral / Surface

#### Light Theme
```css
--color-bg-primary: #ffffff;      /* Page background */
--color-bg-secondary: #f8fafc;    /* Card/panel background */
--color-bg-tertiary: #f1f5f9;     /* Input/hover background */
--color-bg-hover: #e2e8f0;        /* Hover states */
--color-bg-active: #cbd5e1;       /* Active/pressed states */

--color-border-light: #e2e8f0;    /* Default borders */
--color-border-medium: #cbd5e1;   /* Emphasized borders */
--color-border-dark: #94a3b8;     /* Focus rings */

--color-text-primary: #0f172a;    /* Primary text */
--color-text-secondary: #334155;  /* Secondary text */
--color-text-tertiary: #64748b;   /* Muted/disabled text */
--color-text-inverse: #ffffff;    /* On dark backgrounds */
--color-text-link: #2563eb;       /* Links */
```

#### Dark Theme
```css
--color-bg-primary: #0f172a;
--color-bg-secondary: #1e293b;
--color-bg-tertiary: #334155;
--color-bg-hover: #475569;
--color-bg-active: #64748b;

--color-border-light: #334155;
--color-border-medium: #475569;
--color-border-dark: #64748b;

--color-text-primary: #f8fafc;
--color-text-secondary: #e2e8f0;
--color-text-tertiary: #94a3b8;
--color-text-inverse: #0f172a;
--color-text-link: #60a5fa;
```

### Chart Colors (Categorical)
```css
--chart-1: #3b82f6;  /* Blue */
--chart-2: #22c55e;  /* Green */
--chart-3: #f59e0b;  /* Amber */
--chart-4: #ef4444;  /* Red */
--chart-5: #8b5cf6;  /* Violet */
--chart-6: #ec4899;  /* Pink */
--chart-7: #06b6d4;  /* Cyan */
--chart-8: #84cc16;  /* Lime */
```

### Shift Colors
```css
--shift-morning: #2563eb;   /* Blue */
--shift-evening: #f59e0b;   /* Amber */
--shift-night: #1e293b;     /* Dark slate */
```

---

## Typography

### Font Families
```css
--font-sans: 'Vazirmatn', 'Inter', system-ui, -apple-system, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
--font-arabic: 'Vazirmatn', 'Noto Sans Arabic', sans-serif;
```

### Font Sizes (Type Scale)
```css
--text-xs: 0.75rem;      /* 12px - Captions, labels */
--text-sm: 0.875rem;     /* 14px - Body small, inputs */
--text-base: 1rem;       /* 16px - Body default */
--text-lg: 1.125rem;     /* 18px - Body large, subtitles */
--text-xl: 1.25rem;      /* 20px - H5, card titles */
--text-2xl: 1.5rem;      /* 24px - H4, section headers */
--text-3xl: 1.875rem;    /* 30px - H3, page titles */
--text-4xl: 2.25rem;     /* 36px - H2, major sections */
--text-5xl: 3rem;        /* 48px - H1, hero */
```

### Font Weights
```css
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

### Line Heights
```css
--leading-tight: 1.25;   /* Headings */
--leading-normal: 1.5;   /* Body text */
--leading-relaxed: 1.75; /* Long-form content */
```

### Letter Spacing
```css
--tracking-tight: -0.025em;  /* Large headings */
--tracking-normal: 0;        /* Default */
--tracking-wide: 0.025em;    /* Small caps, labels */
```

---

## Spacing

### Base Unit: 4px (0.25rem)
```css
--space-0: 0;
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
--space-20: 5rem;     /* 80px */
--space-24: 6rem;     /* 96px */
```

### Component-Specific Spacing
```css
--space-card-padding: var(--space-4);      /* 16px */
--space-card-gap: var(--space-4);          /* 16px */
--space-form-gap: var(--space-4);          /* 16px */
--space-form-field-gap: var(--space-2);    /* 8px */
--space-button-gap: var(--space-2);        /* 8px */
--space-icon-gap: var(--space-2);          /* 8px */
--space-table-cell-padding: var(--space-3); /* 12px */
--space-modal-padding: var(--space-6);      /* 24px */
--space-page-padding: var(--space-6);       /* 24px */
--space-section-gap: var(--space-8);        /* 32px */
```

---

## Border Radius

```css
--radius-none: 0;
--radius-sm: 0.25rem;    /* 4px - Badges, tags */
--radius-md: 0.375rem;   /* 6px - Buttons, inputs */
--radius-lg: 0.5rem;     /* 8px - Cards, modals */
--radius-xl: 0.75rem;    /* 12px - Large cards */
--radius-2xl: 1rem;      /* 16px - Modals, drawers */
--radius-full: 9999px;   /* Pills, avatars */
```

---

## Shadows

```css
--shadow-xs: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-sm: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
--shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
--shadow-2xl: 0 25px 50px -12px rgb(0 0 0 / 0.25);
--shadow-inner: inset 0 2px 4px 0 rgb(0 0 0 / 0.05);

/* Focus ring */
--shadow-focus: 0 0 0 3px var(--color-primary-200);
--shadow-focus-dark: 0 0 0 3px var(--color-primary-800);
```

---

## Transitions

```css
--transition-fast: 150ms ease;
--transition-normal: 200ms ease;
--transition-slow: 300ms ease;
--transition-slower: 500ms ease;

/* Common patterns */
--transition-colors: color var(--transition-fast), background-color var(--transition-fast), border-color var(--transition-fast);
--transition-transform: transform var(--transition-fast);
--transition-opacity: opacity var(--transition-fast);
--transition-all: all var(--transition-normal);
```

---

## Z-Index Scale

```css
--z-dropdown: 100;
--z-sticky: 200;
--z-fixed: 300;
--z-modal-backdrop: 400;
--z-modal: 500;
--z-popover: 600;
--z-tooltip: 700;
--z-toast: 800;
--z-max: 9999;
```

---

## Breakpoints

```css
--bp-xs: 320px;    /* Mobile small */
--bp-sm: 375px;    /* Mobile */
--bp-md: 768px;    /* Tablet */
--bp-lg: 1024px;   /* Desktop */
--bp-xl: 1280px;   /* Large desktop */
--bp-2xl: 1536px;  /* Extra large */
```

---

## Component Tokens

### Button
```css
--btn-height-sm: 32px;
--btn-height-md: 40px;
--btn-height-lg: 48px;
--btn-padding-x-sm: var(--space-3);
--btn-padding-x-md: var(--space-4);
--btn-padding-x-lg: var(--space-6);
--btn-font-size: var(--text-sm);
--btn-font-weight: var(--font-medium);
--btn-border-radius: var(--radius-md);
```

### Input
```css
--input-height-sm: 32px;
--input-height-md: 40px;
--input-height-lg: 48px;
--input-padding-x: var(--space-3);
--input-padding-y: var(--space-2);
--input-font-size: var(--text-sm);
--input-border-width: 1px;
--input-border-radius: var(--radius-md);
--input-placeholder-color: var(--color-text-tertiary);
```

### Card
```css
--card-bg: var(--color-bg-secondary);
--card-border: var(--color-border-light);
--card-shadow: var(--shadow-sm);
--card-radius: var(--radius-lg);
--card-padding: var(--space-card-padding);
```

### Table
```css
--table-header-bg: var(--color-bg-tertiary);
--table-row-hover-bg: var(--color-bg-hover);
--table-border-color: var(--color-border-light);
--table-header-font-weight: var(--font-semibold);
--table-font-size: var(--text-sm);
```

### Modal/Drawer
```css
--modal-bg: var(--color-bg-primary);
--modal-shadow: var(--shadow-xl);
--modal-radius: var(--radius-2xl);
--modal-max-width: 560px;
--modal-max-height: 90vh;
```

### Badge/Tag
```css
--badge-font-size: var(--text-xs);
--badge-font-weight: var(--font-medium);
--badge-padding-x: var(--space-2);
--badge-padding-y: var(--space-1);
--badge-radius: var(--radius-full);
```

### Tooltip
```css
--tooltip-font-size: var(--text-xs);
--tooltip-bg: var(--color-text-primary);
--tooltip-color: var(--color-text-inverse);
--tooltip-radius: var(--radius-md);
--tooltip-padding: var(--space-2) var(--space-3);
--tooltip-arrow-size: 6px;
```

---

## RTL-Specific Tokens

```css
/* Logical properties (prefer over physical) */
--space-inline-start: var(--space-4);
--space-inline-end: var(--space-4);
--border-inline-start: 1px solid var(--color-border-light);
--border-inline-end: 1px solid var(--color-border-light);

/* Icon mirroring */
--icon-flip-horizontal: scaleX(-1);

/* Text alignment */
--text-align-start: right;
--text-align-end: left;
```

---

## Motion & Animation

```css
/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  --transition-fast: 0ms;
  --transition-normal: 0ms;
  --transition-slow: 0ms;
  --transition-slower: 0ms;
}

/* Keyframe animations */
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slide-in-right {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

@keyframes slide-in-left {
  from { transform: translateX(-100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

@keyframes scale-in {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Animation tokens */
--animate-fade-in: fade-in var(--transition-normal);
--animate-slide-in-right: slide-in-right var(--transition-normal);
--animate-slide-in-left: slide-in-left var(--transition-normal);
--animate-scale-in: scale-in var(--transition-fast);
--animate-spin: spin 1s linear infinite;
--animate-pulse: pulse 2s ease-in-out infinite;
```

---

## Accessibility Tokens

```css
/* Focus visible */
--focus-ring-width: 3px;
--focus-ring-offset: 2px;
--focus-ring-color: var(--color-primary-500);
--focus-ring-color-dark: var(--color-primary-400);

/* Skip link */
--skip-link-bg: var(--color-primary-600);
--skip-link-color: white;
--skip-link-padding: var(--space-3) var(--space-4);

/* High contrast mode */
@media (prefers-contrast: high) {
  --color-border-light: var(--color-text-primary);
  --color-border-medium: var(--color-text-primary);
  --shadow-focus: 0 0 0 4px var(--color-text-primary);
}

/* Screen reader only */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

---

## Usage Guidelines

### Do's
- Use semantic color tokens (`--color-error-600`) not raw values (`#dc2626`)
- Use spacing tokens (`--space-4`) not pixel values (`16px`)
- Use font size tokens (`--text-base`) not `1rem` directly
- Use logical properties for RTL (`margin-inline-start`)
- Use transition tokens for consistent motion

### Don'ts
- Don't hardcode colors, spacing, or font sizes
- Don't use physical properties for layout (`margin-left`)
- Don't create new color values without adding to tokens
- Don't mix light/dark theme values in same component

---

## Implementation

### CSS (Current)
```css
:root {
  /* All tokens defined here */
}

[data-theme="dark"] {
  /* Dark theme overrides */
}
```

### TypeScript (For components)
```typescript
// tokens.ts
export const tokens = {
  colors: { ... },
  spacing: { ... },
  typography: { ... },
  // ...
} as const;

// Usage
const styles = {
  padding: tokens.spacing[4],
  color: tokens.colors.textPrimary,
};
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-11-18 | Initial extraction from current CSS |

---

*These tokens are derived from the current implementation. Update when design system evolves.*