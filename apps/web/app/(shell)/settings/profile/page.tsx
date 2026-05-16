import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { getTranslations } from 'next-intl/server';
import { getUser } from '@/lib/auth';
import { ProfileForm } from './profile-form';

type ProfileLink = { label: string; url: string };

export default async function SettingsProfilePage() {
  const result = await getUser();
  if (!result) redirect('/sign-in?next=/settings/profile' as Route);

  const t = await getTranslations('Settings');

  const { profile } = result;
  // `links` is jsonb; Supabase-generated types model it as Json. The shape is
  // enforced at write time by ProfileLinkSchema (lib/zod/profile.ts).
  const links = (profile.links as ProfileLink[] | null) ?? [];
  return (
    <main style={{ maxWidth: 600, margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
        {t('EditProfile')}
      </h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        {t.rich('SignedInAs', {
          handle: profile.handle,
          b: (chunks) => <strong>{chunks}</strong>,
        })}
      </p>
      <ProfileForm
        initial={{
          display_name: profile.display_name,
          bio: profile.bio,
          links,
          hue: profile.hue ?? 200,
          banner_gradient: profile.banner_gradient,
        }}
        initialAvatarUrl={profile.avatar_url}
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
          {t('SignOut')}
        </button>
      </form>
    </main>
  );
}
