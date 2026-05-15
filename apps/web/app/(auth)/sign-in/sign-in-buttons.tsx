'use client';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export function SignInButtons({ next }: { next: string }) {
  async function signIn(provider: 'github' | 'google') {
    const supabase = createSupabaseBrowserClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
  }

  const buttonStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '0.75rem 1rem',
    fontSize: '1rem',
    border: '1px solid #ccc',
    borderRadius: 8,
    cursor: 'pointer',
    backgroundColor: 'white',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <button type="button" onClick={() => signIn('github')} style={buttonStyle}>
        Continue with GitHub
      </button>
      <button type="button" onClick={() => signIn('google')} style={buttonStyle}>
        Continue with Google
      </button>
    </div>
  );
}
