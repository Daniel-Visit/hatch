import { getLocale, setRequestLocale } from 'next-intl/server';
import { getUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getNotifications } from '@/lib/actions/notifications';
import { Shell } from '../_components/shell';
import { NotificationsBell } from '../_components/notifications-bell';
import { PushPermissionPrompt } from '../_components/push-permission-prompt';

// Prototype CSS now lives in the root `app/layout.tsx` so it is available on
// every route (gallery, sign-in, AND landing — landing.css is scoped under
// `.landing-root` to avoid collisions).

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  setRequestLocale(locale);
  const result = await getUser();

  const shellUser = result
    ? {
        handle: result.profile.handle,
        avatar_url: result.profile.avatar_url,
        hue: result.profile.hue,
        emoji: result.profile.emoji,
        display_name: result.profile.display_name,
      }
    : null;

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

  return (
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
  );
}
