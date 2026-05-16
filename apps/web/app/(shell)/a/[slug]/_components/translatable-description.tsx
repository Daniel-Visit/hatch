'use client';

import TranslateButton from '@/app/_components/translate-button';
import { Markdown } from '@/app/_components/markdown';
import type { Locale } from '@/lib/i18n/locales';

type Props = {
  text: string;
  targetLocale: Locale;
};

export default function TranslatableDescription({ text, targetLocale }: Props) {
  return (
    <TranslateButton text={text} targetLocale={targetLocale}>
      {(display, button) => (
        <>
          {display === text ? (
            <Markdown>{text}</Markdown>
          ) : (
            <p className="app-description-translated">{display}</p>
          )}
          {button}
        </>
      )}
    </TranslateButton>
  );
}
