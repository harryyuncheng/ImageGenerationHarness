import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { usePersistentState } from '../../shared/hooks/use-persistent-state.js';
import { applyResolvedTheme, resolveTheme, themeOptions, type ThemePreference } from './theme.js';

export interface ThemeController {
  theme: ThemePreference;
  selectedThemeIndex: number;
  changeTheme: (value: ThemePreference) => void;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
}

/**
 * Theme changes animate through the browser's view-transition API unless the
 * reader has asked for reduced motion.
 */
export function useTheme(): ThemeController {
  const [theme, setTheme] = usePersistentState<ThemePreference>('harness-theme', 'system');
  const [menuOpen, setMenuOpen] = useState(false);
  const selectedThemeIndex = Math.max(
    themeOptions.findIndex(({ value }) => value === theme),
    0,
  );

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      applyResolvedTheme(resolveTheme(theme, media.matches));
    };
    applyTheme();
    media.addEventListener('change', applyTheme);
    return () => {
      media.removeEventListener('change', applyTheme);
    };
  }, [theme]);

  const changeTheme = (value: ThemePreference) => {
    if (value === theme) return;

    const updateTheme = () => {
      flushSync(() => {
        setTheme(value);
      });
      applyResolvedTheme(
        resolveTheme(value, window.matchMedia('(prefers-color-scheme: dark)').matches),
      );
    };

    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      typeof document.startViewTransition !== 'function'
    ) {
      updateTheme();
      return;
    }

    document.startViewTransition(updateTheme);
  };

  return { theme, selectedThemeIndex, changeTheme, menuOpen, setMenuOpen };
}
