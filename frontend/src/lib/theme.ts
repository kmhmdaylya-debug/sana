export type Theme = 'dark' | 'light';

export function readTheme(): Theme {
  try { return localStorage.getItem('sana-theme') === 'light' ? 'light' : 'dark'; }
  catch { return 'dark'; }
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('sana-theme', theme); } catch { /* Storage may be blocked by browser policy. */ }
}
