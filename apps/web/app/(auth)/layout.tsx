import { getLocale, setRequestLocale } from 'next-intl/server';

// Prototype CSS is loaded once in the root `app/layout.tsx` so every auth page
// (sign-in, publish, etc.) already has access to the shared styling.

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  setRequestLocale(locale);
  // Pass-through wrapper. Each page in (auth) owns its own width/centering.
  // /sign-in uses a full-bleed split layout; /publish wraps itself in the
  // prototype's centered container.
  return <>{children}</>;
}
