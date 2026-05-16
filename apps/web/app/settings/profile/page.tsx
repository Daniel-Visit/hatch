import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { getUser } from '@/lib/auth';
import { ProfileForm } from './profile-form';

type ProfileLink = { label: string; url: string };

export default async function SettingsProfilePage() {
  const result = await getUser();
  if (!result) redirect('/sign-in?next=/settings/profile' as Route);

  const { profile } = result;
  // `links` is jsonb; Supabase-generated types model it as Json. The shape is
  // enforced at write time by ProfileLinkSchema (lib/zod/profile.ts).
  const links = (profile.links as ProfileLink[] | null) ?? [];
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
          links,
          hue: profile.hue ?? 200,
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
