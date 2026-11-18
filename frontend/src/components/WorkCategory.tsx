import { useId } from 'react';
import { Check } from 'lucide-react';
import { categoryStyle, getWorkCategory, WORK_CATEGORIES } from '../lib/workCategories';

export function WorkCategoryTag({ value }: { value?: string | null | undefined }) {
  const category = getWorkCategory(value);
  return category ? <span className="work-category" style={categoryStyle(value)}><span aria-hidden="true" />{category.label}</span> : null;
}

export function WorkCategoryPicker({ value, onChange, disabled, emptyLabel = 'بدون دسته' }: {
  value: string; onChange: (value: string) => void; disabled?: boolean; emptyLabel?: string;
}) {
  const name = useId();
  return <fieldset className="work-category-picker" disabled={disabled}>
    <legend>دسته‌بندی رنگی</legend>
    <div className="work-category-options">
      {[{ key: '', label: emptyLabel, color: 'var(--text-soft)' }, ...WORK_CATEGORIES].map(category => <label key={category.key}>
        <input className="sr-only" type="radio" name={name} value={category.key} checked={value === category.key} onChange={() => onChange(category.key)} />
        <span className="work-category-swatch" style={{ background: category.color }} aria-hidden="true">{value === category.key && <Check size={12} />}</span>
        <span>{category.label}</span>
      </label>)}
    </div>
  </fieldset>;
}
