export const normalizeSearch = (value: string) => value.trim().replace(/ي/g, 'ی').replace(/ك/g, 'ک').toLocaleLowerCase('fa');

export function matchesDocument(row: any, query: string) {
  const text = [row.title, row.employee?.firstName, row.employee?.lastName, row.employee?.code].filter(Boolean).join(' ');
  return normalizeSearch(text).includes(normalizeSearch(query));
}
