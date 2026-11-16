import type { CSSProperties } from 'react';

export const WORK_CATEGORIES = [
  { key: 'DESIGN', label: 'طراحی', color: '#bca3e8' },
  { key: 'DEVELOPMENT', label: 'توسعه', color: '#8bbce8' },
  { key: 'CONTENT', label: 'محتوا', color: '#edbe7e' },
  { key: 'SUPPORT', label: 'پشتیبانی', color: '#7fcfc7' },
  { key: 'OPERATIONS', label: 'عملیات', color: '#e9a6bd' },
  { key: 'GENERAL', label: 'عمومی', color: '#b9c4a0' },
] as const;

export const getWorkCategory = (key?: string | null) => WORK_CATEGORIES.find(category => category.key === key);
export const categoryStyle = (key?: string | null): CSSProperties | undefined => {
  const category = getWorkCategory(key);
  return category ? { '--category-color': category.color } as CSSProperties : undefined;
};
export const categoryColor = (key?: string | null) => getWorkCategory(key)?.color;
