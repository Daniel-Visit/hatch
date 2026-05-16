import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getNotifications } from '@/lib/actions/notifications';
import { ThemeController, themeBootScript } from './_components/theme-controller';
import { Shell } from './_components/shell';
import { fontVariables } from './_components/fonts';
import { NotificationsBell } from './_components/notifications-bell';
import { NotificationToaster } from './_components/notification-toast';
import { ServiceWorkerRegistrar } from './_components/service-worker-registrar';
import { PushPermissionPrompt } from './_components/push-permission-prompt';

// Routes that render full-bleed without the Shell (sidebar + topbar).
const BARE_ROUTE_PREFIXES = ['/sign-in'];

import './globals.css';
import './styles/prototype-base.css';
import './styles/prototype-cards.css';
import './styles/prototype-screens.css';
import './styles/prototype-contact.css';
import './styles/phase6.css';

export const metadata: Metadata = {
  title: 'Hatch · Apps Gallery',
  description: 'Product Hunt for builders.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const result = await getUser();
  const initialTheme = (result?.profile.theme_pref as 'light' | 'dark' | 'system') ?? 'light';
  const signedIn = !!result;

  // Pathname comes from middleware-injected `x-pathname` header.
  const h = await headers();
  const pathname = h.get('x-pathname') ?? '';
  const isBare = BARE_ROUTE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p + '?'),
  );

  // ShellUser shape: { handle, avatar_url, hue, emoji, display_name }
  const shellUser = result
    ? {
        handle: result.profile.handle,
        avatar_url: result.profile.avatar_url,
        hue: result.profile.hue,
        emoji: result.profile.emoji,
        display_name: result.profile.display_name,
      }
    : null;

  // Notification data — fetched server-side when signed in
  let initialUnread = 0;
  let initialNotifs: import('@/lib/actions/notifications').NotificationRow[] = [];
  let hasPushEnabled = false;

  if (result) {
    const sb = await createSupabaseServerClient();
    const { count } = await sb
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', result.user.id)
      .is('read_at', null);
    initialUnread = count ?? 0;

    const notifsResult = await getNotifications({});
    initialNotifs = notifsResult.ok ? notifsResult.data.rows : [];

    hasPushEnabled =
      (result.profile.notification_prefs as Record<string, unknown> | null)?.push_enabled === true;
  }

  // NOTE: themeBootScript is a trusted compile-time constant — not user input.
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const bootHtml = { __html: themeBootScript } as any;

  return (
    <html
      lang="en"
      data-theme={initialTheme === 'system' ? 'light' : initialTheme}
      data-density="regular"
      className={fontVariables}
      suppressHydrationWarning
    >
      <head>
        {/* Anti-flash: apply localStorage theme/density BEFORE first paint */}
        <script dangerouslySetInnerHTML={bootHtml} />
      </head>
      <body>
        <ThemeController initialTheme={initialTheme} initialDensity="regular" signedIn={signedIn}>
          {isBare ? (
            children
          ) : (
            <Shell
              user={shellUser}
              bell={
                result ? (
                  <NotificationsBell
                    userId={result.user.id}
                    initialUnread={initialUnread}
                    initialNotifs={initialNotifs}
                  />
                ) : null
              }
            >
              {children}
              {result && <PushPermissionPrompt hasPushEnabled={hasPushEnabled} />}
            </Shell>
          )}
        </ThemeController>
        <NotificationToaster />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
