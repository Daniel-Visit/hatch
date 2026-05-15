import Link from 'next/link';
import { getUser } from '@/lib/auth';

export default async function HomePage() {
  const result = await getUser();

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
      {result ? (
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
          Hi @{result.profile.handle} — edit profile
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
