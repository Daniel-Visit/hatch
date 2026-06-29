'use client';

// RequestsClient — the optimistic list controller for the builder inbox.
//
// Mirrors the optimistic-removal pattern in
// apps/web/app/(shell)/wanted/_components/match-deck.tsx (lines 54-74):
//   - track acted-upon ids in local state; filter them out of the visible list
//   - POST /api/v1/matches/:id/respond on Connect / Skip
//   - "Decide later" (dismiss) is local-only — no request
//   - on Connect success, show a sent-confirmation notice
//
// No Tailwind — prototype-port exception applies.

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { BuilderRequest } from '@/lib/wanted/match-repo';
import { RequestCard, type SkipFeedback } from './request-card';

type RequestsClientProps = {
  initial: BuilderRequest[];
  capacity: number;
};

export function RequestsClient({ initial, capacity }: RequestsClientProps) {
  const t = useTranslations('Wanted.InboxRequests');

  const [actedIds, setActedIds] = useState<Set<string>>(() => new Set());
  const [notice, setNotice] = useState<string | null>(null);
  // Count ONLY confirmed CONNECT actions — dismiss / skip must not consume slots.
  const [connectedCount, setConnectedCount] = useState(0);

  const visible = initial.filter((r) => !actedIds.has(r.id));

  const onDismiss = useCallback((id: string) => {
    // Local-only — "Decide later" simply hides the card this session.
    setActedIds((prev) => new Set([...prev, id]));
  }, []);

  const onAction = useCallback(
    async (id: string, action: 'CONNECT' | 'SKIP', feedback?: SkipFeedback, note?: string) => {
      // Optimistically remove from the list.
      setActedIds((prev) => new Set([...prev, id]));
      setNotice(null);

      const body = action === 'SKIP' ? { action, feedback, feedbackNote: note } : { action };

      try {
        const res = await fetch(`/api/v1/matches/${id}/respond`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (res.ok && action === 'CONNECT') {
          setConnectedCount((n) => n + 1);
          setNotice(t('connectSuccess'));
        }
      } catch {
        // Optimistic removal stays; a network failure is silent (acceptable UX).
      }
    },
    [t],
  );

  // Capacity indicator — open slots out of total declared capacity.
  // Only confirmed CONNECTs consume a slot; deferrals and skips do not.
  const openSlots = Math.max(0, capacity - connectedCount);

  return (
    <>
      {capacity > 0 && (
        <p
          style={{
            fontFamily: 'var(--mono)',
            fontSize: '11px',
            color: 'var(--muted)',
            margin: '0 0 14px',
          }}
        >
          {t('capacityIndicator', { open: openSlots, total: capacity })}
        </p>
      )}

      {notice && (
        <p
          style={{
            fontFamily: 'var(--mono)',
            fontSize: '12.5px',
            color: 'var(--ax)',
            margin: '0 0 14px',
          }}
        >
          {notice}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {visible.map((request) => (
          <RequestCard
            key={request.id}
            request={request}
            onAction={onAction}
            onDismiss={onDismiss}
          />
        ))}
      </div>

      {visible.length === 0 && (
        <div
          style={{
            padding: '40px 20px',
            textAlign: 'center',
            color: 'var(--muted)',
            fontFamily: 'var(--mono)',
            fontSize: '13px',
          }}
        >
          <p style={{ margin: 0, fontWeight: 600, color: 'var(--text)' }}>{t('emptyTitle')}</p>
        </div>
      )}
    </>
  );
}
