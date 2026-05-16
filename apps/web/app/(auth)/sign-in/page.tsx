import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Route } from 'next';
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
          <em>Show what you&apos;re building.</em> A community gallery for indie builders shipping
          side projects in public.
        </p>
      </aside>

      <section className={styles.form}>
        <div className={styles.formInner}>
          <div className={styles.mobileLogo}>
            <HatchLogo />
          </div>

          <div className={styles.heading}>
            <h1 className={styles.title}>Welcome back</h1>
            <p className={styles.subtitle}>
              Sign in to like, save, comment on apps, and talk to other builders.
            </p>
          </div>

          {params.error && (
            <div className={styles.errorPill}>Sign-in failed. Please try again.</div>
          )}

          <SignInButtons next={next} />

          <p className={styles.legal}>
            By continuing you agree to Hatch&apos;s Terms of Service and Privacy Policy.
          </p>

          <div className={styles.divider}>or</div>

          <p className={styles.footer}>
            Just browsing?{' '}
            <Link href={'/' as Route} className={styles.footerLink}>
              Back to Hatch →
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
