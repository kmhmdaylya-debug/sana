# Sana HRMS - Persian RTL Localization Audit

**Version:** 1.0  
**Date:** 2026-11-18  
**Auditor:** Senior Localization Engineer  
**Classification:** INTERNAL  

---

## 1. Overview

This audit evaluates Persian RTL support, Jalali calendar handling, Persian number formatting, and mixed-direction text handling across the Sana HRMS application.

---

## 1. RTL Implementation

### 1.1 Base RTL Setup

| Aspect | Status | Implementation |
|--------|--------|----------------|
| `dir="rtl"` on body | ✅ | `body { direction: rtl; }` in global.css |
| HTML `lang` attribute | ✅ | `<html lang="fa" dir="rtl">` |
| CSS Logical Properties | 90% | Most spacing uses `margin-inline`, `padding-inline` |
| Flexbox Direction | 95% | RTL-aware, some hardcoded `flex-direction` |
| Grid Direction | 100% | RTL-aware grid |
| Scrollbars | ✅ | RTL scrollbars styled |

### 1.2 RTL Issues Found

| Issue | Location | Severity |
|-------|----------|----------|
| Hardcoded `margin-left`/`right` | 12 locations in CSS | Medium |
| Hardcoded `left`/`right` positioning | 8 locations | Medium |
| Icon flip missing | 3 icons (Chevron) | Low |
| Flexbox `justify-content` not logical | 5 locations | Low |

---

## 2. Jalali Calendar Implementation

### 2.1 Date Handling Architecture

| Layer | Implementation | Status |
|-------|----------------|--------|
| Storage | ISO 8601 UTC in DB | ✅ |
| Backend Processing | `format.ts` utilities | ✅ |
| Frontend Display | `formatJalali()`, `parseDateInput()` | ✅ |
| DatePicker | `DatePicker.tsx` with `jalaali-js` | ✅ |
| API Contract | ISO 8601 strings | ✅ |

### 2.2 Jalali Date Functions (format.ts)

| Function | Status | Notes |
|----------|--------|-------|
| `formatJalali()` | ✅ | Full formatting options |
| `parseDateInput()` | ✅ | Handles Persian digits, separators |
| `toJalali()` | ✅ | Gregorian → Jalali |
| `toGregorian()` | ✅ | Jalali → Gregorian |
| `toPersianDigits()` | ✅ | Used in display |
| `toEnglishDigits()` | ✅ | Used in parsing |
| `formatJalaliDateTime()` | ✅ | DateTime formatting |
| `parseJalaliDateTime()` | ✅ | Parsing |
| `formatJalaliRelative()` | ✅ | Relative time |

### 2.3 DatePicker Component

| Feature | Status | Notes |
|---------|--------|-------|
| RTL Calendar Grid | ✅ | Weekdays: ش-ج |
| Month Navigation | ✅ | ChevronLeft/Right swap |
| Year/Month Select | ✅ | Dropdown |
| Today Button | ✅ | "امروز" |
| Clear Button | ✅ | X icon |
| Keyboard Navigation | ✅ | Arrow keys, Enter, Escape |
| Today Highlight | ✅ | Visual indicator |
| Selected Date | ✅ | Visual indicator |
| Disabled Dates | ✅ | Supported |
| Range Selection | ❌ | Not implemented |

---

## 3. Persian Number Formatting

### 2.1 Number Display

| Function | Status | Usage |
|---------|--------|-------|
| `toPersianDigits()` | ✅ | All numeric display |
| `toEnglishDigits()` | ✅ | Input parsing |
| `formatNumber()` | ✅ | Grouped numbers |
| `formatRial()` | ✅ | Currency (ریال) |
| `formatToman()` | ✅ | Currency (تومان) |
| `formatPercent()` | ✅ | Percentages |
| `formatMinutes()` | ✅ | Duration display |

### 2.2 Number Formatting Consistency

| Context | Persian Digits | Status |
|---------|----------------|--------|
| Table numbers | ✅ | Consistent |
| Form inputs | ✅ | Auto-convert on blur |
| Currency display | ✅ | Consistent |
| Percentages | ✅ | Consistent |
| Dates | ✅ | Consistent |
| Counters/Badges | ✅ | Consistent |
| Charts/Graphs | ✅ | Canvas text |

---

## 3. Date & Time Handling

### 3.1 Date Display Formats

| Format | Example (Jalali) | Example (Gregorian) |
|--------|------------------|---------------------|
| Short Date | ۱۴۰۳/۰۸/۲۴ | 2024-11-15 |
| Long Date | ۲۴ آبان ۱۴۰۳ | 2024-11-15 |
| DateTime | ۱۴۰۳/۰۸/۲۴ ۱۴:۳۰ | 2024-11-15 14:30 |
| Time Only | ۱۴:۳۰ | 14:30 |
| Relative | ۲ ساعت پیش | 2 hours ago |

### 3.2 Time Handling

| Aspect | Implementation |
|--------|----------------|
| Timezone | Asia/Tehran (UTC+3:30) |
| Storage | UTC in DB |
| Display | Local Tehran time |
| DST | Not applicable (Iran no DST) |

---

## 4. Persian Text Handling

### 3.1 Text Direction

| Element | Direction | Implementation |
|---------|-----------|----------------|
| Body text | RTL | `dir="rtl"` on body |
| Inputs | RTL | `dir="rtl"` on form elements |
| Numbers | LTR | `dir="ltr"` on numeric inputs |
| Emails/URLs | LTR | `.ltr` utility class |
| Code/IDs | LTR | `.ltr` utility class |
| Mixed content | Bidi | Unicode bidi algorithm |

### 3.2 Mixed Content Handling

| Content Type | Handling | Status |
|-------------|----------|--------|
| Email in Persian text | `.ltr` span | ✅ |
| URL in Persian text | `.ltr` span | ✅ |
| ID/Code in text | `.ltr` span | ✅ |
| Phone numbers | `.ltr` + Persian digits | ✅ |
| Mixed paragraphs | Unicode bidi | ⚠️ Partial |

**Issue:** Long mixed-direction paragraphs may have bidi issues with punctuation.

---

## 4. Formatting Utilities (format.ts)

### 4.1 Key Functions

| Function | Purpose | Status |
|---------|---------|-------|
| `toPersianDigits(str)` | Convert 0-9 to ۰-۹ | ✅ |
| `toEnglishDigits(str)` | Convert ۰-۹ to 0-9 | ✅ |
| `formatJalali(date)` | Date → Jalali string | ✅ |
| `parseDateInput(str)` | String → ISO date | ✅ |
| `formatJalaliDateTime(date)` | DateTime formatting | ✅ |
| `formatRial(amount)` | Rial formatting | ✅ |
| `formatToman(amount)` | Toman formatting | ✅ |
| `formatPercent(value)` | Percentage | ✅ |
| `formatNumber(num)` | Grouped numbers | ✅ |
| `toPersianDigits(num)` | Number → Persian digits | ✅ |

### 3.2 Format Options

| Option | Values | Default |
|---------|--------|---------|
| `weekday` | short, long | short |
| `year` | numeric, 2-digit | numeric |
| `month` | numeric, 2-digit, long, short | long |
| `day` | numeric, 2-digit | numeric |
| `hour` | 2-digit, numeric | 2-digit |
| `minute` | 2-digit, numeric | 2-digit |
| `second` | 2-digit, numeric | 2-digit |

---

## 4. Currency Formatting

### 4.1 Rial/Toman

| Function | Example Output |
|---------|----------------|
| `formatRial(12345678)` | ۱۲,۳۴۵,۶۷۸ ریال |
| `formatToman(12345678)` | ۱,۲۳۴,۵۶۸ تومان |
| `formatRial(0)` | ۰ ریال |
| Negative | (۱۲,۳۴۵,۶۷۸) ریال |

---

## 4. Percent & Number Formatting

| Function | Example Input | Output |
|---------|---------------|--------|
| `formatPercent(0.1234)` | ۰.۱۲۳۴ | ۱۲.۳۴٪ |
| `formatNumber(1234567)` | ۱۲۳۴۵۶۷ | ۱,۲۳۴,۵۶۷ |
| `formatMinutes(150)` | ۱۵۰ | ۲ ساعت و ۳۰ دقیقه |

---

## 5. Jalali Calendar Edge Cases

### 5.1 Leap Years

| Year | Leap? | Days | Last Day |
|------|-------|------|----------|
| 1400 | Yes | 366 | ۳۰ اسفند |
| 1401 | No | 365 | ۲۹ اسفند |
| 1402 | No | 365 | ۲۹ اسفند |
| 1403 | No | 365 | ۲۹ اسفند |
| 1404 | Yes | 366 | ۳۰ اسفند |

### 5.2 Month Lengths

| Month | Days (Normal) | Days (Leap) |
|-------|---------------|-------------|
| فروردین | 31 | 31 |
| اردیبهشت | 31 | 31 |
| خرداد | 31 | 31 |
| تیر | 31 | 31 |
| مرداد | 31 | 31 |
| شهریور | 31 | 31 |
| مهر | 30 | 30 |
| آبان | 30 | 30 |
| آذر | 30 | 30 |
| دی | 30 | 30 |
| بهمن | 30 | 30 |
| اسفند | 29 | 30 |

---

## 5. Input Parsing

### 5.1 Accepted Formats

| Format | Example | Parsed |
|-------|---------|--------|
| `yyyy/MM/dd` | ۱۴۰۳/۰۸/۲۴ | ✅ |
| `yyyy-MM-dd` | 1403-08-24 | ✅ |
| `yyyy.MM.dd` | 1403.08.24 | ✅ |
| `yyyy M d` | 1403 8 24 | ✅ |
| Compact | 14030824 | ✅ |

### 4.2 Time Input

| Format | Example |
|--------|---------|
| HH:mm | 14:30 |
| H:mm | 14:30 |
| HH:mm:ss | 14:30:00 |

---

## 5. Exported Documents

### 5.1 PDF/Excel Export

| Aspect | Status |
|---------|--------|
| RTL Layout | ✅ |
| Persian Fonts | ✅ (Vazirmatn embedded) |
| Numbers | ✅ Persian digits |
| Dates | ✅ Jalali |
| Currency | ✅ Rial/Toman |
| RTL Tables | ✅ Column order reversed |

---

## 6. Issues & Gaps

### 5.1 Identified Gaps

| Gap | Severity | Location |
|-------|----------|----------|
| DatePicker range selection | Medium | DatePicker.tsx |
| DatePicker accessibility (aria-label) | Medium | DatePicker.tsx |
| Mixed bidi text punctuation | Low | General |
| Light mode RTL shadows | Low | tokens.css |
| DatePicker year dropdown max | Low | DatePicker.tsx |

---

## 5. Recommendations

1. **Add DatePicker range selection** - High priority for leave/attendance
2. **Add aria-label to DatePicker** - Accessibility
3. **Test mixed bidi edge cases** - Long mixed paragraphs
4. **Verify light mode RTL shadows** - Visual consistency

---

**Document Version:** 1.0  
**Date:** 2026-11-18  
**Status:** Complete  
**Classification:** INTERNAL