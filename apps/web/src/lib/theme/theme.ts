const STORAGE_KEY = 'badgers-theme';

export type Theme = 'light' | 'dark';

export function toggleTheme(): void {
  const root = document.documentElement;
  const isDark = root.classList.contains('dark');
  const nextDark = !isDark;
  root.classList.toggle('dark', nextDark);
  try {
    localStorage.setItem(STORAGE_KEY, nextDark ? 'dark' : 'light');
  } catch {
    void 0;
  }
}

export function readResolvedThemeFromDocument(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}
