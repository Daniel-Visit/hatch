export const LOCALES = ['en', 'es'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';
export function isLocale(s: string | undefined | null): s is Locale {
  return s === 'en' || s === 'es';
}
