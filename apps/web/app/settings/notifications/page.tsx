import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { requireUser } from '@/lib/auth';
import { NotificationsForm } from './_components/notifications-form';
import type { NotificationPrefsT } from '@/lib/zod/notification-prefs';

const DEFAULT_PREFS: NotificationPrefsT = {
  push_enabled: false,
  push_likes: false,
  push_follows: false,
  push_comments: true,
  push_messages: true,
  push_contact_requests: true,
};

export const dynamic = 'force-dynamic';

export default async function SettingsNotificationsRoute() {
  let profile;
  try {
    ({ profile } = await requireUser());
  } catch {
    redirect('/sign-in?next=/settings/notifications' as Route);
  }

  const prefs = (profile.notification_prefs as NotificationPrefsT | null) ?? DEFAULT_PREFS;

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '32px 16px' }}>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: 8 }}>Notifications</h1>
      <p style={{ color: 'var(--text-2)', marginBottom: 24 }}>
        Choose what fires a browser notification when Hatch isn&apos;t in front of you.
      </p>
      <NotificationsForm initialPrefs={prefs} />
    </main>
  );
}
