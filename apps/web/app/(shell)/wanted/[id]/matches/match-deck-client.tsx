'use client';

// MatchDeckClient — thin client wrapper for the seeker's match deck page.
//
// Receives the initial matches array loaded server-side (page.tsx) and passes
// it straight to <MatchDeck>. Kept separate so page.tsx stays a pure Server
// Component while the interactive deck stays client-only.

import { MatchDeck } from '../../_components/match-deck';
import type { MatchSummary } from '../../_components/match-card';

type MatchDeckClientProps = {
  briefId: string;
  initialMatches: MatchSummary[];
};

export function MatchDeckClient({ briefId, initialMatches }: MatchDeckClientProps) {
  return <MatchDeck briefId={briefId} initialMatches={initialMatches} />;
}
