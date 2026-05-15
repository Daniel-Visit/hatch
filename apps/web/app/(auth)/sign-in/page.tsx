import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { getUser } from '@/lib/auth';
import { SignInButtons } from './sign-in-buttons';

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const user = await getUser();
  if (user) redirect((params.next ?? '/settings/profile') as Route);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, textAlign: 'center' }}>Sign in to Hatch</h1>
      {params.error && (
        <p style={{ color: 'crimson', textAlign: 'center' }}>Sign-in failed. Please try again.</p>
      )}
      <SignInButtons next={params.next ?? '/settings/profile'} />
    </div>
  );
}
