import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { getTranslations } from 'next-intl/server';
import { getUser } from '@/lib/auth';
import { SignInButtons } from './sign-in-buttons';
import { SignInArt } from './sign-in-art';
import { HatchLogo } from './hatch-logo';
import styles from './sign-in.module.css';

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const user = await getUser();
  if (user) redirect((params.next ?? '/settings/profile') as Route);

  const next = params.next ?? '/settings/profile';
  const t = await getTranslations('SignIn');

  return (
    <div className={styles.shell}>
      <aside className={styles.brand}>
        <div className={styles.brandHeader}>
          <HatchLogo />
        </div>

        <div className={styles.gridWrap}>
          <SignInArt />
        </div>

        <p className={styles.brandTagline}>
          {t.rich('BrandTagline', {
            em: (chunks) => <em>{chunks}</em>,
          })}
        </p>
      </aside>

      <section className={styles.form}>
        <div className={styles.formInner}>
          <div className={styles.mobileLogo}>
            <HatchLogo />
          </div>

          <div className={styles.heading}>
            <h1 className={styles.title}>{t('WelcomeBack')}</h1>
            <p className={styles.subtitle}>{t('Subtitle')}</p>
          </div>

          {params.error && <div className={styles.errorPill}>{t('SignInFailed')}</div>}

          <SignInButtons next={next} />

          <p className={styles.legal}>{t('LegalLine')}</p>

          <div className={styles.divider}>{t('OrSeparator')}</div>

          <p className={styles.footer}>
            {t('JustBrowsing')}{' '}
            <Link href={'/' as Route} className={styles.footerLink}>
              {t('BackToHatch')}
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
