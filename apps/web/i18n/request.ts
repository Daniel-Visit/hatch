import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/lib/i18n/locales';
import { getUser } from '@/lib/auth';

export default getRequestConfig(async () => {
  let locale: Locale = DEFAULT_LOCALE;

  const cookieValue = (await cookies()).get('NEXT_LOCALE')?.value;
  if (isLocale(cookieValue)) {
    locale = cookieValue;
  } else {
    try {
      const result = await getUser();
      const pref = (result?.profile as { locale_pref?: string | null } | undefined)?.locale_pref;
      if (typeof pref === 'string' && isLocale(pref)) {
        locale = pref;
      } else {
        const accept = (await headers()).get('accept-language')?.toLowerCase() ?? '';
        if (accept.split(',')[0]?.startsWith('es')) {
          locale = 'es';
        }
      }
    } catch {
      // keep default — never block layout on a Supabase failure
    }
  }

  const messages = (await import(`../messages/${locale}.json`)).default;
  return { locale, messages };
});
