import { getLocale, setRequestLocale } from 'next-intl/server';

// Auth pages (/sign-in, /publish, etc.) depend on the same prototype CSS as the
// gallery shell for their logo, app-art mosaic, contact modal, etc. Re-import
// the same set the (shell) layout uses so styling isn't lost on auth routes.
import '../styles/prototype-base.css';
import '../styles/prototype-cards.css';
import '../styles/prototype-screens.css';
import '../styles/prototype-contact.css';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  setRequestLocale(locale);
  // Pass-through wrapper. Each page in (auth) owns its own width/centering.
  // /sign-in uses a full-bleed split layout; /publish wraps itself in the
  // prototype's centered container.
  return <>{children}</>;
}
