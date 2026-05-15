import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { getUser } from '@/lib/auth';
import type { Database } from '@/lib/supabase/types';
import { ProfileForm } from './profile-form';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

export default async function SettingsProfilePage() {
  const result = await getUser();
  if (!result) redirect('/sign-in?next=/settings/profile' as Route);

  // Local supabase typing through @supabase/ssr drops the row type to `never`
  // due to a known ssr<->supabase-js generic mismatch (regenerated in Phase 1b).
  // Cast back to the concrete Row shape.
  const profile = result.profile as ProfileRow;
  return (
    <main style={{ maxWidth: 600, margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>Edit profile</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        Signed in as <strong>@{profile.handle}</strong>
      </p>
      <ProfileForm
        initial={{
          display_name: profile.display_name,
          bio: profile.bio,
          links: profile.links ?? [],
        }}
      />
      <form action="/auth/sign-out" method="post" style={{ marginTop: '3rem' }}>
        <button
          type="submit"
          style={{
            padding: '0.5rem 1rem',
            border: '1px solid #ccc',
            borderRadius: 8,
            cursor: 'pointer',
            backgroundColor: 'white',
          }}
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
