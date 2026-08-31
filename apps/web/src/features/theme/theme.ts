import { Hammer, Monitor, Moon, Scissors, Sun, type LucideIcon } from 'lucide-react';

type MatTheme = 'mat-light' | 'mat-dark' | 'mat-build' | 'mat-craft';
type ResolvedTheme = 'light' | 'dark' | MatTheme;
export type ThemePreference = ResolvedTheme | 'system';

export const themeGroups: readonly {
  id: string;
  label: string;
  hint: string;
  options: readonly { value: ThemePreference; label: string; Icon: LucideIcon }[];
}[] = [
  {
    id: 'basic',
    label: 'Basic',
    hint: 'A flat background across the whole studio.',
    options: [
      { value: 'light', label: 'Light', Icon: Sun },
      { value: 'dark', label: 'Dark', Icon: Moon },
      { value: 'system', label: 'System', Icon: Monitor },
    ],
  },
  {
    id: 'cutting-mat',
    label: 'Cutting mat',
    hint: 'A ruled mat behind the create canvas.',
    options: [
      { value: 'mat-light', label: 'Light', Icon: Sun },
      { value: 'mat-dark', label: 'Dark', Icon: Moon },
      { value: 'mat-build', label: 'Build', Icon: Hammer },
      { value: 'mat-craft', label: 'Craft', Icon: Scissors },
    ],
  },
];

export function resolveTheme(theme: ThemePreference, systemIsDark: boolean): ResolvedTheme {
  return theme === 'system' ? (systemIsDark ? 'dark' : 'light') : theme;
}

/** The two palettes a preview swatch is split between; only System shows a seam. */
export function previewFaces(theme: ThemePreference): readonly [ResolvedTheme, ResolvedTheme] {
  return theme === 'system' ? ['light', 'dark'] : [theme, theme];
}

export function applyResolvedTheme(theme: ResolvedTheme) {
  const root = document.documentElement;
  root.dataset['theme'] = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', getComputedStyle(root).getPropertyValue('--bg').trim());
}
