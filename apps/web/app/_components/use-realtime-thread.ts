'use client';

import { useEffect, useRef } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

type RealtimeThreadOptions = {
  conversationId: string;
  onInsert: (row: MessageRow) => void;
  onBackfill?: (rows: MessageRow[]) => void;
};

const BACKFILL_THRESHOLD_MS = 30 * 1000;

export function useRealtimeThread({
  conversationId,
  onInsert,
  onBackfill,
}: RealtimeThreadOptions): void {
  const hiddenSinceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!conversationId) return undefined;
    const sb = createSupabaseBrowserClient();

    const channel = sb
      .channel(`msgs:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          onInsert(payload.new as MessageRow);
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
      const { data } = await sb
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (data) onBackfill(data as unknown as MessageRow[]);
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      sb.removeChannel(channel);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [conversationId, onInsert, onBackfill]);
}
