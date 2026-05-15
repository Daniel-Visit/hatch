'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { setThemePref } from '@/lib/actions/theme';

export type Theme = 'light' | 'dark' | 'system';
export type Density = 'compact' | 'regular' | 'comfy';

interface ThemeContextValue {
  theme: Theme;
  density: Density;
  setTheme: (t: Theme) => void;
  setDensity: (d: Density) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeControllerProps {
  initialTheme: Theme;
  initialDensity: Density;
  signedIn: boolean;
  children: ReactNode;
}

export function ThemeController({
  initialTheme,
  initialDensity,
  signedIn,
  children,
}: ThemeControllerProps) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);
  const [density, setDensityState] = useState<Density>(initialDensity);

  // Sync from localStorage on mount (overrides SSR initial if anon stored a pref)
  useEffect(() => {
    const storedTheme = (
      typeof window !== 'undefined' ? window.localStorage.getItem('theme') : null
    ) as Theme | null;
    const storedDensity = (
      typeof window !== 'undefined' ? window.localStorage.getItem('density') : null
    ) as Density | null;
    if (storedTheme && storedTheme !== theme) setThemeState(storedTheme);
    if (storedDensity && storedDensity !== density) setDensityState(storedDensity);
  }, [theme, density]);

  // Apply attrs whenever state changes
  useEffect(() => {
    const html = document.documentElement;
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      html.dataset.theme = prefersDark ? 'dark' : 'light';
    } else {
      html.dataset.theme = theme;
    }
    html.dataset.density = density;
  }, [theme, density]);

  const setTheme = useCallback(
    (t: Theme) => {
      setThemeState(t);
      if (typeof window !== 'undefined') window.localStorage.setItem('theme', t);
      if (signedIn) void setThemePref(t);
    },
    [signedIn],
  );

  const setDensity = useCallback((d: Density) => {
    setDensityState(d);
    if (typeof window !== 'undefined') window.localStorage.setItem('density', d);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, density, setTheme, setDensity }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within <ThemeController>');
  return ctx;
}

// Inline script injected into <head> by app/layout.tsx to prevent flash-of-wrong-theme.
// Reads localStorage and applies data-theme/data-density before first paint.
export const themeBootScript = `
(function() {
  try {
    var t = localStorage.getItem('theme');
    var d = localStorage.getItem('density');
    if (t === 'system' || !t) {
      t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.dataset.theme = t;
    document.documentElement.dataset.density = d || 'regular';
  } catch (e) {}
})();
`;
