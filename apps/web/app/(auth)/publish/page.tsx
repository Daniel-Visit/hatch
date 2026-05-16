import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PublishScreen } from '@/app/_components/publish-screen';

export default async function PublishPage() {
  const viewer = await getUser();
  if (!viewer) {
    redirect('/sign-in?next=/publish');
  }

  const sb = await createSupabaseServerClient();
  const { data: categories } = await sb
    .from('categories')
    .select('id, label, icon')
    .order('sort_order', { ascending: true });

  return (
    <PublishScreen
      categories={categories ?? []}
      viewer={{
        handle: viewer.profile.handle,
        display_name: viewer.profile.display_name,
        avatar_url: viewer.profile.avatar_url,
        hue: viewer.profile.hue,
        emoji: viewer.profile.emoji ?? '◇',
      }}
      cardStyle="classic"
    />
  );
}
