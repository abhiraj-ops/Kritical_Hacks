import { useCallback, useEffect, useState } from 'react';

export const THEMES = ['midnight', 'aurora', 'frost', 'graphite'] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_META: Record<Theme, { label: string; hint: string }> = {
  midnight: { label: 'Midnight', hint: 'Deep navy with cyan glows' },
  aurora: { label: 'Aurora', hint: 'Teal and violet gradients' },
  frost: { label: 'Frost', hint: 'Light glass, soft blue and white' },
  graphite: { label: 'Graphite', hint: 'Near-black, high contrast' },
};

const STORAGE_KEY = 'ecopulse-theme';

/** Must match the inline bootstrap in index.html. */
function resolveInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'midnight';
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr && (THEMES as readonly string[]).includes(attr)) return attr as Theme;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored && (THEMES as readonly string[]).includes(stored)) return stored as Theme;
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'frost' : 'midnight';
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(resolveInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* private mode — theme still applies for this session */
    }
  }, [theme]);

  const setTheme = useCallback((next: Theme) => setThemeState(next), []);

  /** Cycle order used by the keyboard shortcut and the compact button. */
  const cycleTheme = useCallback(() => {
    setThemeState((prev) => {
      const i = THEMES.indexOf(prev);
      return THEMES[(i + 1) % THEMES.length];
    });
  }, []);

  return { theme, setTheme, cycleTheme };
}