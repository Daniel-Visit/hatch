import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { requireUser } from '@/lib/auth';
import { getNotifications } from '@/lib/actions/notifications';
import { NotificationsPage } from './_components/notifications-page';

export const dynamic = 'force-dynamic';

export default async function NotificationsRoute({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  let user;
  try {
    ({ user } = await requireUser());
  } catch {
    redirect('/sign-in?next=/notifications' as Route);
  }

  const params = await searchParams;
  const filter = params.filter as 'all' | 'unread' | 'contact' | 'message' | 'social' | undefined;

  const initial = await getNotifications({});
  const initialRows = initial.ok ? initial.data.rows : [];
  const nextCursor = initial.ok ? initial.data.nextCursor : null;

  return (
    <NotificationsPage
      userId={user.id}
      initialRows={initialRows}
      initialCursor={nextCursor}
      initialFilter={filter ?? 'all'}
    />
  );
}
