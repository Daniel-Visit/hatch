'use client';

import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { setLocale } from '@/lib/actions/locale';
import { LOCALES, type Locale } from '@/lib/i18n/locales';

export function LocaleToggle({ className }: { className?: string }) {
  const current = useLocale() as Locale;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onPick(next: Locale) {
    if (next === current || pending) return;
    startTransition(async () => {
      const result = await setLocale(next);
      if (result.ok) {
        router.refresh();
      }
    });
  }

  return (
    <div
      className={`locale-toggle ${className ?? ''}`}
      data-locale-toggle
      data-active-locale={current}
      role="group"
      aria-label="Language"
    >
      {LOCALES.map((loc) => (
        <button
          key={loc}
          type="button"
          className="locale-toggle__segment"
          data-target-locale={loc}
          data-active={loc === current ? 'true' : 'false'}
          disabled={pending}
          onClick={() => onPick(loc)}
          aria-pressed={loc === current}
        >
          {loc.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
