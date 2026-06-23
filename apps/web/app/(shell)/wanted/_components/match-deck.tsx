'use client';

// MatchDeck — the card stack for the seeker's swipe view.
//
// Verbatim port of .match-deck from mockups.html #matches.
// Handles:
//   - keyboard arrows (→ = Connect, ← = Skip)
//   - touch swipe: right = Connect, left = Skip (§4.3)
//   - POST /api/v1/matches/:id/swipe on each action
//   - advancing to next card after swipe
//   - banner: "This might already exist" (top app ≥ 75 conf) or "custom build"
//   - empty state
//
// NOTE: no Tailwind — prototype-port exception applies.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { MatchCard, type MatchSummary } from './match-card';
import { MatchBanner } from './match-banner';

// Minimum horizontal distance (px) for a touch gesture to register as a swipe.
const SWIPE_THRESHOLD = 50;

type MatchDeckProps = {
  /** The brief id — reserved for future polling/refresh. */
  briefId: string;
  initialMatches: MatchSummary[];
};

export function MatchDeck({ initialMatches }: MatchDeckProps) {
  const t = useTranslations('Wanted.MatchDeck');

  // Track which matches have been acted upon (removed from visible deck).
  const [actedIds, setActedIds] = useState<Set<string>>(() => new Set());
  // Track sent-confirmation notice (shown after Connect).
  const [notice, setNotice] = useState<string | null>(null);

  const deckRef = useRef<HTMLDivElement>(null);
  // Touch tracking refs — store on ref to avoid stale closures in event handlers.
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const visibleMatches = initialMatches.filter((m) => !actedIds.has(m.id));

  // Determine whether to show the "This might already exist" banner:
  // show when at least one APP match has confidence >= 75 AND is still visible.
  const topAppMatch = visibleMatches.find(
    (m) => m.candidateType === 'APP' && Math.round(m.agentConfidence * 100) >= 75,
  );

  // Builder-only count for "custom build" banner (when no high-conf app match visible).
  const visibleBuilderCount = visibleMatches.filter((m) => m.candidateType === 'BUILDER').length;

  const handleSwipe = useCallback(
    async (matchId: string, action: 'CONNECT' | 'SKIP') => {
      // Optimistically remove from deck.
      setActedIds((prev) => new Set([...prev, matchId]));
      setNotice(null);

      try {
        const res = await fetch(`/api/v1/matches/${matchId}/swipe`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action }),
        });
        if (res.ok && action === 'CONNECT') {
          setNotice(t('sentConfirmation'));
        }
      } catch {
        // Optimistic removal stays; network failure is silent (acceptable UX for swipe).
      }
    },
    [t],
  );

  // Keyboard navigation: → Connect, ← Skip on first visible card.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (visibleMatches.length === 0) return;
      // Avoid interfering with input fields or button focus.
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLButtonElement
      ) {
        return;
      }
      const first = visibleMatches[0];
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        void handleSwipe(first.id, 'CONNECT');
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        void handleSwipe(first.id, 'SKIP');
      }
      // Note: Esc = "expand details" per §4.3 is NOT implemented — the mockup
      // #matches / #zoom section defines no expanded card state for the deck view.
      // There is no expanded-card markup in the mockup, so this gesture is deferred.
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [visibleMatches, handleSwipe]);

  // Touch swipe: attach to deck container. Right = Connect, Left = Skip on first card.
  useEffect(() => {
    const el = deckRef.current;
    if (!el) return;

    function onTouchStart(e: TouchEvent) {
      const t0 = e.touches[0];
      if (!t0) return;
      touchStartX.current = t0.clientX;
      touchStartY.current = t0.clientY;
    }

    function onTouchEnd(e: TouchEvent) {
      if (touchStartX.current === null || touchStartY.current === null) return;
      const t0 = e.changedTouches[0];
      if (!t0) return;

      const dx = t0.clientX - touchStartX.current;
      const dy = t0.clientY - touchStartY.current;

      touchStartX.current = null;
      touchStartY.current = null;

      // Only treat as a horizontal swipe if lateral distance dominates vertical.
      if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;

      if (visibleMatches.length === 0) return;
      const first = visibleMatches[0];
      void handleSwipe(first.id, dx > 0 ? 'CONNECT' : 'SKIP');
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [visibleMatches, handleSwipe]);

  // ── Banner logic ─────────────────────────────────────────────────────────────

  let bannerTitle: string | null = null;
  let bannerBody: string | null = null;

  if (topAppMatch) {
    const confPct = Math.round(topAppMatch.agentConfidence * 100);
    bannerTitle = t('existingAppBannerTitle');
    bannerBody = t('existingAppBannerBody', { score: confPct });
  } else if (visibleBuilderCount > 0) {
    bannerTitle = t('customBuildBannerTitle');
    bannerBody = t('customBuildBannerBody', { count: visibleBuilderCount });
  }

  // ── Empty state (no matches at all) ──────────────────────────────────────────

  if (visibleMatches.length === 0 && initialMatches.length === 0) {
    return (
      <div
        style={{
          padding: '40px 20px',
          textAlign: 'center',
          color: 'var(--muted)',
          fontFamily: 'var(--mono)',
          fontSize: '13px',
        }}
      >
        <p style={{ margin: '0 0 6px', fontWeight: 600, color: 'var(--text)' }}>
          {t('noMatchesTitle')}
        </p>
        <p style={{ margin: 0 }}>{t('noMatchesBody')}</p>
      </div>
    );
  }

  return (
    <>
      {/* Banner */}
      {bannerTitle && bannerBody && <MatchBanner title={bannerTitle} body={bannerBody} />}

      {/* Sent confirmation notice */}
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

      {/* Keyboard hint (visible when deck has cards) */}
      {visibleMatches.length > 0 && (
        <p
          style={{
            fontFamily: 'var(--mono)',
            fontSize: '11px',
            color: 'var(--muted)',
            margin: '0 0 14px',
          }}
          aria-live="polite"
        >
          ← Skip &nbsp;·&nbsp; → Connect
        </p>
      )}

      {/* The deck grid */}
      <div className="match-deck" ref={deckRef}>
        {visibleMatches.map((match) => (
          <MatchCard key={match.id} match={match} seekerView={true} onSwipe={handleSwipe} />
        ))}
      </div>

      {/* Post-swipe empty state: all acted upon */}
      {visibleMatches.length === 0 && initialMatches.length > 0 && (
        <div
          style={{
            padding: '40px 20px',
            textAlign: 'center',
            color: 'var(--muted)',
            fontFamily: 'var(--mono)',
            fontSize: '13px',
          }}
        >
          <p style={{ margin: '0 0 6px', fontWeight: 600, color: 'var(--text)' }}>
            {t('noMatchesTitle')}
          </p>
          <p style={{ margin: 0 }}>{t('noMatchesBody')}</p>
        </div>
      )}
    </>
  );
}
