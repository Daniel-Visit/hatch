'use client';

import { useEffect, useRef } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { NotificationRow } from '@/lib/actions/notifications';

type RealtimeNotifsOptions = {
  userId: string;
  onInsert: (row: NotificationRow) => void;
  onBackfill?: (rows: NotificationRow[]) => void; // SPEC §8.3 visibilitychange refetch
};

const BACKFILL_THRESHOLD_MS = 30 * 1000; // 30 seconds hidden → refetch on visible

export function useRealtimeNotifs({ userId, onInsert, onBackfill }: RealtimeNotifsOptions): void {
  const hiddenSinceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!userId) return undefined;
    const sb = createSupabaseBrowserClient();

    const channel = sb
      .channel(`notifs:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          onInsert(payload.new as NotificationRow);
        },
      )
      .subscribe();

    const onVisibilityChange = async () => {
      if (document.visibilityState === 'hidden') {
        hiddenSinceRef.current = Date.now();
        return;
      }
      if (document.visibilityState !== 'visible' || hiddenSinceRef.current === null) return;
      const hiddenFor = Date.now() - hiddenSinceRef.current;
      hiddenSinceRef.current = null;
      if (hiddenFor < BACKFILL_THRESHOLD_MS) return;
      if (!onBackfill) return;
      // Refetch latest 50 for this recipient
      const { data } = await sb
        .from('notifications')
        .select(
          '*, actor:profiles!notifications_actor_id_fkey(handle, display_name, avatar_url, hue, emoji), app:apps(id, slug, title, accent, art_kind), contact_request:contact_requests(id, sender_link, role)',
        )
        .eq('recipient_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (data) onBackfill(data as unknown as NotificationRow[]);
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      sb.removeChannel(channel);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [userId, onInsert, onBackfill]);
}
