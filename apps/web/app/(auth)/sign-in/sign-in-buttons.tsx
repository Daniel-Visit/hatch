'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import styles from './sign-in.module.css';

export function SignInButtons({ next }: { next: string }) {
  const t = useTranslations('SignIn');
  const [pending, setPending] = useState<'github' | 'google' | null>(null);

  async function signIn(provider: 'github' | 'google') {
    setPending(provider);
    const supabase = createSupabaseBrowserClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
  }

  return (
    <div className={styles.buttons}>
      <OauthButton
        onClick={() => signIn('github')}
        label={pending === 'github' ? t('Redirecting') : t('ContinueWithGitHub')}
        disabled={pending !== null}
      >
        <GithubIcon />
      </OauthButton>
      <OauthButton
        onClick={() => signIn('google')}
        label={pending === 'google' ? t('Redirecting') : t('ContinueWithGoogle')}
        disabled={pending !== null}
      >
        <GoogleIcon />
      </OauthButton>
    </div>
  );
}

function OauthButton({
  onClick,
  label,
  children,
  disabled,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        width: '100%',
        padding: '14px 18px',
        fontSize: 15,
        fontWeight: 500,
        border: '1px solid var(--border)',
        borderRadius: 12,
        background: 'var(--surface)',
        color: 'var(--text)',
        cursor: disabled ? 'wait' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'background 150ms ease, transform 80ms ease',
        fontFamily: 'inherit',
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = 'var(--surface-2)';
      }}
      onMouseLeave={(e) => {
        if (!disabled) e.currentTarget.style.background = 'var(--surface)';
      }}
      onMouseDown={(e) => {
        if (!disabled) e.currentTarget.style.transform = 'scale(0.99)';
      }}
      onMouseUp={(e) => {
        if (!disabled) e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          width: 20,
          height: 20,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {children}
      </span>
      <span>{label}</span>
    </button>
  );
}

function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.27-.01-1-.02-1.97-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.69 1.25 3.35.95.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.59.23 2.76.11 3.05.74.81 1.18 1.84 1.18 3.1 0 4.42-2.7 5.39-5.26 5.68.41.36.78 1.06.78 2.14 0 1.54-.01 2.78-.01 3.16 0 .31.21.68.8.56C20.71 21.38 24 17.08 24 12 24 5.65 18.85.5 12.5.5Z"
      />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.44c-.28 1.46-1.13 2.7-2.4 3.53v2.93h3.88c2.27-2.09 3.57-5.18 3.57-8.7Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.93l-3.88-2.93c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.27v3.11A11.99 11.99 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.34a7.18 7.18 0 0 1 0-4.68V6.55H1.27a12.02 12.02 0 0 0 0 10.9l4-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.43-3.43C17.95 1.22 15.24 0 12 0A11.99 11.99 0 0 0 1.27 6.55l4 3.11C6.22 6.88 8.87 4.77 12 4.77Z"
      />
    </svg>
  );
}
