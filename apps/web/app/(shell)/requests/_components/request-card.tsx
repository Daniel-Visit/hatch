'use client';

// RequestCard — a single incoming brief in the builder inbox.
//
// Verbatim prototype-port of the `.card-request` markup from new/mockups.html
// #inbox (lines 1850-1892). No Tailwind — prototype-port exception applies.
//
// Privacy note: BuilderRequest intentionally exposes NO seeker PII (no handle,
// no display name). The identity line in `.card-request-id` therefore shows the
// brief itself (title + expiry), and the avatar uses a neutral, deterministic
// hue derived from the brief id rather than a person.

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { BuilderRequest } from '@/lib/wanted/match-repo';
import type { BriefContent } from '@hatch/shared';

export type SkipFeedback = 'not_my_area' | 'no_capacity' | 'budget_mismatch' | 'other';

type RequestCardProps = {
  request: BuilderRequest;
  onAction: (
    id: string,
    action: 'CONNECT' | 'SKIP',
    feedback?: SkipFeedback,
    note?: string,
  ) => void;
  onDismiss: (id: string) => void;
};

// ── Enum → readable label maps (mirrors the hardcoded English in
//    refiner-ui/budget-picker.tsx — prototype-port files map enums locally). ──

const BUDGET_LABELS: Record<NonNullable<BuilderRequest['budgetBand']>, string> = {
  EXPLORATORY: 'exploratory',
  LT_500: '< $500',
  FROM_500_2K: '$500 – $2k',
  FROM_2K_10K: '$2k – $10k',
  GT_10K: '> $10k',
  OPEN: 'open',
};

const TIMELINE_LABELS: Record<NonNullable<BuilderRequest['timeline']>, string> = {
  ASAP: 'ASAP',
  WEEKS: 'weeks',
  MONTHS: 'months',
  NO_RUSH: 'no rush',
};

const SOLUTION_LABELS: Record<BuilderRequest['solutionTypes'][number], string> = {
  EXISTING_APP: 'existing app',
  CUSTOM_BUILD: 'custom build',
  FORK_AND_MODIFY: 'fork & modify',
  CONSULTING: 'consulting',
};

const SKIP_REASONS: SkipFeedback[] = ['not_my_area', 'no_capacity', 'budget_mismatch', 'other'];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Deterministic avatar hue (0-360) from the brief id — neutral, no PII. */
function hueFromId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) % 360;
  }
  return h;
}

/** Short "expires in Xh / Xd" string from an ISO expiry timestamp. */
function formatExpiresIn(iso: string): string {
  if (!iso) return 'no expiry';
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return 'no expiry';
  if (ms <= 0) return 'expired';
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 24) return `expires in ${hours}h`;
  const days = Math.floor(hours / 24);
  return `expires in ${days}d`;
}

/** Build the Problem paragraph from the brief's problem block. */
function problemText(content: BriefContent): string {
  const p = content.problem ?? {};
  return [p.trigger, p.affected].filter(Boolean).join(' ');
}

/** Build the Desired-end-state paragraph from the brief's outcome block. */
function endStateText(content: BriefContent): string {
  const d = content.desiredOutcome ?? {};
  if (d.definitionOfGoodEnough) return d.definitionOfGoodEnough;
  const must = d.mustHaves ?? [];
  return must.join(' · ');
}

export function RequestCard({ request, onAction, onDismiss }: RequestCardProps) {
  const t = useTranslations('Wanted.InboxRequests');
  const [skipOpen, setSkipOpen] = useState(false);

  const title = request.title ?? '';
  const initial = (title.trim()[0] ?? '◌').toUpperCase();
  const hue = hueFromId(request.briefId);
  const confPct = Math.round(request.agentConfidence * 100);

  const problem = problemText(request.content);
  const endState = endStateText(request.content);

  const reasonLabel: Record<SkipFeedback, string> = {
    not_my_area: t('reasonNotMyArea'),
    no_capacity: t('reasonNoCapacity'),
    budget_mismatch: t('reasonBudgetMismatch'),
    other: t('reasonOther'),
  };

  return (
    <article className="card-request">
      <header className="card-request-head">
        <span
          className="avatar"
          style={{
            background: `oklch(72% .15 ${hue})`,
            width: '36px',
            height: '36px',
            fontSize: '15px',
          }}
        >
          {initial}
        </span>
        <div className="card-request-id">
          <b>{title}</b>
          <i>{formatExpiresIn(request.expiresAt)}</i>
        </div>
        <span className="card-request-conf">{t('confidencePct', { pct: confPct })}</span>
      </header>

      <div className="card-request-body">
        <h3 className="card-request-title">{title}</h3>

        {problem && (
          <div className="card-request-section">
            <h5>{t('problem')}</h5>
            <p>{problem}</p>
          </div>
        )}

        {endState && (
          <div className="card-request-section">
            <h5>{t('endState')}</h5>
            <p>{endState}</p>
          </div>
        )}

        <div className="card-request-section">
          <h5>{t('constraints')}</h5>
          <div className="card-request-meta-row">
            {request.budgetBand && (
              <span className="meta-pill">
                <i>$</i>
                {BUDGET_LABELS[request.budgetBand]}
              </span>
            )}
            {request.timeline && (
              <span className="meta-pill">
                <i>⏱</i>
                {TIMELINE_LABELS[request.timeline]}
              </span>
            )}
            {request.solutionTypes.map((s) => (
              <span className="meta-pill" key={s}>
                <i>◐</i>
                {SOLUTION_LABELS[s]}
              </span>
            ))}
          </div>
        </div>

        {request.agentRationale && (
          <div className="card-request-rationale">
            <b>{t('whyYou')}</b> {request.agentRationale}
          </div>
        )}
      </div>

      <footer className="card-request-foot">
        {skipOpen ? (
          <div className="card-request-meta-row" style={{ flex: 1, justifyContent: 'flex-end' }}>
            {SKIP_REASONS.map((reason) => (
              <button
                key={reason}
                className="btn btn-ghost-2"
                onClick={() => onAction(request.id, 'SKIP', reason)}
              >
                {reasonLabel[reason]}
              </button>
            ))}
          </div>
        ) : (
          <>
            <button className="btn btn-ghost" onClick={() => onDismiss(request.id)}>
              {t('decideLater')}
            </button>
            <button className="btn btn-ghost-2" onClick={() => setSkipOpen(true)}>
              {t('skip')}
            </button>
            <button className="btn btn-primary" onClick={() => onAction(request.id, 'CONNECT')}>
              {t('connect')}
            </button>
          </>
        )}
      </footer>
    </article>
  );
}
