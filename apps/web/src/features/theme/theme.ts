import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';

export type ThemePreference = 'light' | 'dark' | 'system';
type ResolvedTheme = Exclude<ThemePreference, 'system'>;

export const themeOptions: readonly {
  value: ThemePreference;
  label: string;
  Icon: LucideIcon;
}[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
];

export function resolveTheme(theme: ThemePreference, systemIsDark: boolean): ResolvedTheme {
  return theme === 'system' ? (systemIsDark ? 'dark' : 'light') : theme;
}

export function applyResolvedTheme(theme: ResolvedTheme) {
  document.documentElement.dataset['theme'] = theme;
  document.documentElement.style.colorScheme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#101010' : '#f7f7f7');
}
