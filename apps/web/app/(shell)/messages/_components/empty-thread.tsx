import { getTranslations } from 'next-intl/server';

export async function EmptyThread() {
  const t = await getTranslations('Messages');
  return (
    <section
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 8,
        color: 'var(--text-2)',
      }}
    >
      <p style={{ fontSize: '1.1rem' }}>{t('EmptyThread')}</p>
      <p style={{ fontSize: '0.85rem' }}>{t('EmptyThreadHint')}</p>
    </section>
  );
}
