import Link from 'next/link';
import { getUser } from '@/lib/auth';
import type { Database } from '@/lib/supabase/types';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

export default async function HomePage() {
  const result = await getUser();

  // Local supabase typing through @supabase/ssr drops the row type to `never`
  // due to a known ssr<->supabase-js generic mismatch (Phase 1b workaround).
  const profile = result ? (result.profile as ProfileRow) : null;

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '1.5rem',
      }}
    >
      <h1 style={{ fontSize: '3rem', fontWeight: 700 }}>Hatch</h1>
      {profile ? (
        <Link
          href="/settings/profile"
          style={{
            padding: '0.75rem 1.5rem',
            border: '1px solid #ccc',
            borderRadius: 8,
            color: 'inherit',
            textDecoration: 'none',
          }}
        >
          Hi @{profile.handle} — edit profile
        </Link>
      ) : (
        <Link
          href="/sign-in"
          style={{
            padding: '0.75rem 1.5rem',
            border: '1px solid #ccc',
            borderRadius: 8,
            color: 'inherit',
            textDecoration: 'none',
          }}
        >
          Sign in
        </Link>
      )}
    </main>
  );
}
