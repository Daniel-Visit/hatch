'use client';

// PASTE mode client (§4.4.4b).
//
// Flow:
//   1. compose — big textarea + live char counter (80–4000). "Parse it" creates
//      a PASTE-mode brief (POST /api/v1/briefs carries pastedText) → PARSING.
//   2. parsing — open the Parser SSE (POST /:id/parse). structured_update fills
//      the review form live; parser_summary shows the banner; done → review.
//   3. review — inferred fields are editable (autosave via PATCH /content); when
//      completeness >= 0.5, "Validate & match" → POST /validate → /[id]/health.
//
// Verbatim prototype-port: `.paste-mode*` / `.paste-textarea` / `.paste-counter*`
// / `.paste-foot` / `.paste-guidance` plus the shared editable components. No
// Tailwind.

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { useTranslations } from 'next-intl';
import {
  type BriefContent,
  BriefContentSchema,
  computeCompletenessScore,
  PARSE_MAX_CHARS,
} from '@hatch/shared';
import { applyDraftPatch, setContentPath } from '@/lib/wanted/brief-state';
import { EditableField } from '../../_components/editable-field';
import { RemovableChip } from '../../_components/removable-chip';
import { streamParse } from './parse-sse-client';

const PASTE_MIN_CHARS = 80;
const VALIDATE_FLOOR = 0.5;

type Phase = 'compose' | 'parsing' | 'review';

type ParserBanner = {
  extracted: string;
  missing: string;
  lowConfidence: boolean;
};

export function PasteModeClient() {
  const t = useTranslations('Wanted.PasteMode');
  const tForm = useTranslations('Wanted.FormMode');
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>('compose');
  const [text, setText] = useState('');
  const [draft, setDraft] = useState<BriefContent>(() => BriefContentSchema.parse({}));
  const [completeness, setCompleteness] = useState(0);
  const [manuallyEditedFields, setManuallyEditedFields] = useState<string[]>([]);
  const [banner, setBanner] = useState<ParserBanner | null>(null);
  const [validating, setValidating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const briefIdRef = useRef<string | null>(null);

  const len = text.length;
  const counterClass =
    len === 0 || len < PASTE_MIN_CHARS ? 'is-short' : len > PARSE_MAX_CHARS ? 'is-long' : 'is-ok';
  const canParse = len >= PASTE_MIN_CHARS && len <= PARSE_MAX_CHARS && phase === 'compose';

  const handleParse = useCallback(async () => {
    if (!canParse) return;
    setNotice(null);
    setPhase('parsing');

    // Create the PASTE-mode brief — the route stores `pastedText` in parsed_from
    // and returns status PARSING.
    let id = briefIdRef.current;
    if (!id) {
      try {
        const res = await fetch('/api/v1/briefs', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ mode: 'paste', pastedText: text }),
        });
        if (!res.ok) throw new Error(`create failed: ${res.status}`);
        const j = (await res.json()) as { briefId: string };
        id = j.briefId;
        briefIdRef.current = id;
      } catch {
        setPhase('compose');
        setNotice(t('parseCta'));
        return;
      }
    }

    // Run the Parser SSE: fill the form live, surface the banner, then review.
    await streamParse(id, {
      onStructuredUpdate: ({ patch }) => {
        setDraft((d) => {
          const next = applyDraftPatch(d, patch as Partial<BriefContent>);
          setCompleteness(computeCompletenessScore(next));
          return next;
        });
      },
      onParserSummary: ({ extractedFields, missingFields, parserConfidence }) => {
        setBanner({
          extracted: extractedFields.join(', ') || '—',
          missing: missingFields.join(', ') || '—',
          lowConfidence: parserConfidence < 0.4,
        });
      },
      onDone: () => {
        setPhase('review');
      },
      onError: () => {
        setPhase('review');
        setNotice(t('parseCta'));
      },
    });
    // Defensive: if the stream closed without done, still allow review.
    setPhase((p) => (p === 'parsing' ? 'review' : p));
  }, [canParse, text, t]);

  // Autosave a field edit during review.
  const persist = useCallback(async (path: string, value: string | string[]) => {
    setDraft((d) => setContentPath(d, path, value));
    const id = briefIdRef.current;
    if (!id) return;
    try {
      const res = await fetch(`/api/v1/briefs/${id}/content`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path, value }),
      });
      if (!res.ok) return;
      const j = (await res.json()) as {
        manuallyEditedFields: string[];
        completenessScore: number;
      };
      setManuallyEditedFields(j.manuallyEditedFields);
      setCompleteness(j.completenessScore);
    } catch {
      // Optimistic value remains.
    }
  }, []);

  const handlePatch = useCallback(
    (path: string, value: string) => void persist(path, value),
    [persist],
  );
  const handlePatchArray = useCallback(
    (path: string, value: string[]) => void persist(path, value),
    [persist],
  );

  const handleValidate = useCallback(async () => {
    if (completeness < VALIDATE_FLOOR || validating) return;
    const id = briefIdRef.current;
    if (!id) return;
    setNotice(null);
    setValidating(true);
    try {
      const res = await fetch(`/api/v1/briefs/${id}/validate`, { method: 'POST' });
      if (!res.ok) {
        setValidating(false);
        setNotice(t('validateCta'));
        return;
      }
      router.push(`/wanted/${id}/health` as Route);
    } catch {
      setValidating(false);
      setNotice(t('validateCta'));
    }
  }, [completeness, validating, router, t]);

  const mef = manuallyEditedFields;

  // ── Compose / parsing screen (textarea) ──
  if (phase === 'compose' || phase === 'parsing') {
    return (
      <div className="paste-mode">
        <div className="paste-mode-head">
          <h1>{t('pageTitle')}</h1>
          <p>{t('pageSubtitle')}</p>
        </div>

        <textarea
          className="paste-textarea"
          placeholder={t('placeholder')}
          value={text}
          disabled={phase === 'parsing'}
          onChange={(e) => setText(e.target.value)}
        />

        <div className={`paste-counter ${counterClass}`}>{t('counter', { count: len })}</div>

        {notice && (
          <div className="paste-counter is-long" role="status">
            {notice}
          </div>
        )}

        <div className="paste-foot">
          <span className="paste-guidance">{t('guidance')}</span>
          <button className="btn btn-primary" onClick={handleParse} disabled={!canParse}>
            {phase === 'parsing' ? t('parsing') : t('parseCta')}
          </button>
        </div>
      </div>
    );
  }

  // ── Review screen (inferred fields, editable) ──
  const pct = Math.round(completeness * 100);
  const canValidate = completeness >= VALIDATE_FLOOR && !validating;

  return (
    <div className="form-mode">
      <div className="form-mode-head">
        <h1>{t('pageTitle')}</h1>
        <span className="form-completeness">
          <span className="form-completeness-bar">
            <span className="form-completeness-bar-fill" style={{ width: `${pct}%` }} />
          </span>
          {tForm('completeness', { pct })}
        </span>
      </div>

      {banner && (
        <div
          className="match-potential"
          role="status"
          style={
            banner.lowConfidence
              ? {
                  background: 'color-mix(in oklab, #f59e0b 8%, var(--surface))',
                  borderColor: 'color-mix(in oklab, #f59e0b 30%, var(--border))',
                }
              : undefined
          }
        >
          <div className="match-potential-glyph">✦</div>
          <div className="match-potential-content">
            <span style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
              {t('bannerExtracted', { extracted: banner.extracted, missing: banner.missing })}
            </span>
          </div>
        </div>
      )}

      <div className="form-section">
        <div className="form-section-body">
          <EditableField
            path="title"
            label={tForm('fields.title')}
            value={draft.title ?? ''}
            manuallyEdited={mef.includes('title')}
            onPatch={handlePatch}
          />
          <EditableField
            path="problem.trigger"
            label={tForm('fields.trigger')}
            value={draft.problem?.trigger ?? ''}
            manuallyEdited={mef.includes('problem.trigger')}
            onPatch={handlePatch}
          />
          <EditableField
            path="problem.currentWorkaround"
            label={tForm('fields.currentWorkaround')}
            value={draft.problem?.currentWorkaround ?? ''}
            manuallyEdited={mef.includes('problem.currentWorkaround')}
            onPatch={handlePatch}
          />
          <EditableField
            path="desiredOutcome.definitionOfGoodEnough"
            label={tForm('fields.definitionOfGoodEnough')}
            value={draft.desiredOutcome?.definitionOfGoodEnough ?? ''}
            manuallyEdited={mef.includes('desiredOutcome.definitionOfGoodEnough')}
            onPatch={handlePatch}
          />
          <RemovableChip
            path="desiredOutcome.mustHaves"
            label={tForm('fields.mustHaves')}
            items={draft.desiredOutcome?.mustHaves ?? []}
            onPatch={handlePatchArray}
          />
          <RemovableChip
            path="desiredOutcome.outOfScope"
            label={tForm('fields.outOfScope')}
            items={draft.desiredOutcome?.outOfScope ?? []}
            onPatch={handlePatchArray}
          />
        </div>
      </div>

      {notice && (
        <div className="form-completeness" role="status" style={{ color: '#dc2626' }}>
          {notice}
        </div>
      )}

      <div className="form-foot">
        <button className="btn btn-primary" onClick={handleValidate} disabled={!canValidate}>
          {validating ? '…' : t('validateCta')}
        </button>
      </div>
    </div>
  );
}
