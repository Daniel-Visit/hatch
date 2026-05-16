'use client';

import { useCallback, useEffect, useOptimistic, useRef, useState, useTransition } from 'react';
import { sendMessage, markConversationRead } from '@/lib/actions/messages';
import { useRealtimeThread, type MessageRow } from '@/app/_components/use-realtime-thread';
import { toast } from 'sonner';

type Props = {
  conversationId: string;
  userId: string;
  other: {
    id: string;
    handle: string;
    display_name: string;
    avatar_url: string | null;
    hue: number;
    emoji: string | null;
  };
  initialMessages: MessageRow[];
};

type OptimisticMessage = MessageRow & { __optimistic?: boolean };

const AT_BOTTOM_THRESHOLD_PX = 80;

export function MessageThread({ conversationId, userId, other, initialMessages }: Props) {
  const [serverMessages, setServerMessages] = useState<MessageRow[]>(initialMessages);
  const [optimistic, addOptimistic] = useOptimistic<OptimisticMessage[], OptimisticMessage>(
    serverMessages,
    (state, newMsg) => {
      // Dedupe by id then sort ascending by created_at
      const merged = [...state.filter((m) => m.id !== newMsg.id), newMsg];
      return merged.sort((a, b) => a.created_at.localeCompare(b.created_at));
    },
  );

  const [body, setBody] = useState('');
  const [newMessagePill, setNewMessagePill] = useState(false);
  const [isPending, startTransition] = useTransition();

  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);

  // Mark conversation read on mount
  useEffect(() => {
    void markConversationRead({ conversationId }).catch(() => {});
  }, [conversationId]);

  // Auto-scroll to bottom on initial render
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  // Track scroll position to know whether to auto-scroll on new messages
  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - (el.scrollTop + el.clientHeight);
    atBottomRef.current = distanceFromBottom <= AT_BOTTOM_THRESHOLD_PX;
    if (atBottomRef.current) setNewMessagePill(false);
  }, []);

  // Realtime: handle a single incoming INSERT row
  const onRealtimeInsert = useCallback(
    (row: MessageRow) => {
      setServerMessages((prev) => {
        if (prev.some((m) => m.id === row.id)) return prev;
        return [...prev, row].sort((a, b) => a.created_at.localeCompare(b.created_at));
      });

      if (atBottomRef.current) {
        requestAnimationFrame(() => {
          if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        });
        void markConversationRead({ conversationId }).catch(() => {});
      } else {
        setNewMessagePill(true);
      }
    },
    [conversationId],
  );

  // Realtime: visibilitychange backfill — dedupe any rows we already have
  const onRealtimeBackfill = useCallback((rows: MessageRow[]) => {
    setServerMessages((prev) => {
      const ids = new Set(prev.map((r) => r.id));
      const fresh = rows.filter((r) => !ids.has(r.id));
      if (fresh.length === 0) return prev;
      return [...prev, ...fresh].sort((a, b) => a.created_at.localeCompare(b.created_at));
    });
  }, []);

  useRealtimeThread({
    conversationId,
    onInsert: onRealtimeInsert,
    onBackfill: onRealtimeBackfill,
  });

  const onSend = useCallback(() => {
    const trimmed = body.trim();
    if (!trimmed) return;

    const tempId = `temp:${Date.now()}`;
    const placeholder: OptimisticMessage = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: userId,
      body: trimmed,
      read_at: null,
      created_at: new Date().toISOString(),
      __optimistic: true,
    };

    // Capture body so we can restore it if the send fails
    const previousBody = body;
    setBody('');

    startTransition(async () => {
      addOptimistic(placeholder);

      const result = await sendMessage({ conversationId, body: trimmed });

      if (result.ok) {
        // Belt-and-suspenders: push the confirmed row into serverMessages in case
        // the realtime subscription is delayed. Dedupe guard prevents double-add.
        setServerMessages((prev) => {
          if (prev.some((m) => m.id === result.data.id)) return prev;
          return [
            ...prev,
            {
              id: result.data.id,
              conversation_id: conversationId,
              sender_id: userId,
              body: trimmed,
              read_at: null,
              created_at: placeholder.created_at,
            },
          ].sort((a, b) => a.created_at.localeCompare(b.created_at));
        });
        // Auto-scroll after our own send
        requestAnimationFrame(() => {
          if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        });
      } else {
        // Rollback: restore textarea content and surface an error toast
        setBody(previousBody);
        toast.error('Failed to send message. Please try again.');
      }
    });
  }, [body, conversationId, userId, addOptimistic]);

  const onTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      onSend();
    }
  };

  const scrollToBottom = useCallback(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    setNewMessagePill(false);
    void markConversationRead({ conversationId }).catch(() => {});
  }, [conversationId]);

  return (
    <section
      style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}
    >
      <header style={{ padding: 16, borderBottom: '1px solid var(--border)' }}>
        <strong>{other.display_name}</strong>{' '}
        <span style={{ color: 'var(--text-2)', fontSize: '0.85rem' }}>@{other.handle}</span>
      </header>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {optimistic.map((m) => (
          <div
            key={m.id}
            style={{
              alignSelf: m.sender_id === userId ? 'flex-end' : 'flex-start',
              background: m.sender_id === userId ? 'var(--accent, #2563eb)' : 'var(--surface-2)',
              color: m.sender_id === userId ? 'white' : 'inherit',
              padding: '8px 12px',
              borderRadius: 16,
              maxWidth: '70%',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              opacity: m.__optimistic ? 0.7 : 1,
              transition: 'opacity 150ms ease',
            }}
          >
            {m.body}
          </div>
        ))}
      </div>

      {newMessagePill && (
        <button
          type="button"
          onClick={scrollToBottom}
          style={{
            position: 'absolute',
            bottom: 96,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '6px 14px',
            borderRadius: 999,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            cursor: 'pointer',
            fontSize: '0.85rem',
            whiteSpace: 'nowrap',
          }}
        >
          ↓ New messages
        </button>
      )}

      <footer
        style={{
          padding: 16,
          borderTop: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={onTextareaKeyDown}
          placeholder="Type a message — ⌘↵ to send"
          rows={2}
          style={{
            width: '100%',
            padding: 8,
            border: '1px solid var(--border)',
            borderRadius: 8,
            fontFamily: 'inherit',
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
          disabled={isPending}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onSend}
            disabled={isPending || !body.trim()}
            style={{
              padding: '6px 16px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--accent, #2563eb)',
              color: 'white',
              cursor: isPending || !body.trim() ? 'not-allowed' : 'pointer',
              opacity: isPending || !body.trim() ? 0.6 : 1,
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {isPending && (
              <span
                style={{
                  display: 'inline-block',
                  width: 12,
                  height: 12,
                  border: '2px solid rgba(255,255,255,0.4)',
                  borderTopColor: 'white',
                  borderRadius: '50%',
                  animation: 'spin 0.6s linear infinite',
                }}
              />
            )}
            Send
          </button>
        </div>
      </footer>
    </section>
  );
}
