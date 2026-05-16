import { z } from 'zod';
import { LOCALES, type Locale } from '@/lib/i18n/locales';

export const LocaleInput = z.enum(LOCALES as unknown as [Locale, ...Locale[]]);
export type LocaleInputType = z.infer<typeof LocaleInput>;
