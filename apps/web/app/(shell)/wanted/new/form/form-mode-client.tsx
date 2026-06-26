'use client';

// FORM mode client (§4.4.4a). Full-page structured brief entry.
//
// Flow:
//   1. On mount, lazily create a FORM-mode brief (POST /api/v1/briefs).
//   2. Each field edit autosaves via PATCH /api/v1/briefs/:id/content. Optimistic
//      local state; the server returns the recomputed completenessScore.
//   3. A live completeness bar in the header reflects the score.
//   4. When completeness >= 0.5, "Validate & match" enables → POST /validate →
//      redirect to /wanted/[id]/health.
//
// Verbatim prototype-port: uses `.form-mode*` / `.form-section*` / `.form-field`
// / `.form-label` / `.form-completeness*` class names from wanted.css plus the
// shared EditableField / RemovableChip components (which carry their own
// `.brief-summary-*` classes). No Tailwind.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { useTranslations } from 'next-intl';
import { type BriefContent, BriefContentSchema, computeCompletenessScore } from '@hatch/shared';
import { setContentPath } from '@/lib/wanted/brief-state';
import { EditableField } from '../../_components/editable-field';
import { RemovableChip } from '../../_components/removable-chip';

const VALIDATE_FLOOR = 0.5;

export function FormModeClient() {
  const t = useTranslations('Wanted.FormMode');
  const router = useRouter();

  const [draft, setDraft] = useState<BriefContent>(() => BriefContentSchema.parse({}));
  const [completeness, setCompleteness] = useState(0);
  const [manuallyEditedFields, setManuallyEditedFields] = useState<string[]>([]);
  const [validating, setValidating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Ref mirror of briefId so handlers read the latest value without a stale
  // closure (autosave can fire before the create promise resolves into state).
  const briefIdRef = useRef<string | null>(null);
  const creatingRef = useRef<Promise<string | null> | null>(null);

  // Lazily create (once) the FORM-mode brief. Returns the id or null on failure.
  const ensureBrief = useCallback(async (): Promise<string | null> => {
    if (briefIdRef.current) return briefIdRef.current;
    if (creatingRef.current) return creatingRef.current;

    const promise = (async () => {
      try {
        const res = await fetch('/api/v1/briefs', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ mode: 'form' }),
        });
        if (!res.ok) throw new Error(`create failed: ${res.status}`);
        const j = (await res.json()) as { briefId: string };
        briefIdRef.current = j.briefId;
        return j.briefId;
      } catch {
        return null;
      }
    })();
    creatingRef.current = promise;
    return promise;
  }, []);

  // Create the brief eagerly on mount so the first autosave persists.
  useEffect(() => {
    void ensureBrief();
  }, [ensureBrief]);

  // Persist a single field edit (scalar or array). Optimistic local update first.
  const persist = useCallback(
    async (path: string, value: string | string[]) => {
      setDraft((d) => setContentPath(d, path, value));
      const id = await ensureBrief();
      if (!id) {
        // Keep the optimistic value; recompute completeness locally so the bar
        // still reflects the edit even when the server is unreachable.
        setDraft((d) => {
          setCompleteness(computeCompletenessScore(d));
          return d;
        });
        return;
      }
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
        // Optimistic value remains; server reconciles on next successful patch.
      }
    },
    [ensureBrief],
  );

  const handlePatch = useCallback(
    (path: string, value: string) => void persist(path, value),
    [persist],
  );
  const handlePatchArray = useCallback(
    (path: string, value: string[]) => void persist(path, value),
    [persist],
  );

  // Enum select handler — empty option clears (writes ''), which the server
  // treats as a normal value; the completeness check keys off presence.
  const handleSelect = useCallback(
    (path: string, value: string) => void persist(path, value),
    [persist],
  );

  const handleValidate = useCallback(async () => {
    if (completeness < VALIDATE_FLOOR || validating) return;
    setNotice(null);
    setValidating(true);
    const id = await ensureBrief();
    if (!id) {
      setValidating(false);
      setNotice(t('validateCta'));
      return;
    }
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
  }, [completeness, validating, ensureBrief, router, t]);

  const mef = manuallyEditedFields;
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
          {t('completeness', { pct })}
        </span>
      </div>

      {/* Title (no section wrapper — top-level field) */}
      <div className="form-section">
        <div className="form-section-body">
          <EditableField
            path="title"
            label={t('fields.title')}
            value={draft.title ?? ''}
            manuallyEdited={mef.includes('title')}
            onPatch={handlePatch}
          />
        </div>
      </div>

      {/* The problem */}
      <div className="form-section">
        <div className="form-section-head">
          <h2>{t('sections.problem')}</h2>
        </div>
        <div className="form-section-body">
          <EditableField
            path="problem.trigger"
            label={t('fields.trigger')}
            value={draft.problem?.trigger ?? ''}
            manuallyEdited={mef.includes('problem.trigger')}
            onPatch={handlePatch}
          />
          <EditableField
            path="problem.currentWorkaround"
            label={t('fields.currentWorkaround')}
            value={draft.problem?.currentWorkaround ?? ''}
            manuallyEdited={mef.includes('problem.currentWorkaround')}
            onPatch={handlePatch}
          />
          <EditableField
            path="problem.costOfNotSolving"
            label={t('fields.costOfNotSolving')}
            value={draft.problem?.costOfNotSolving ?? ''}
            manuallyEdited={mef.includes('problem.costOfNotSolving')}
            onPatch={handlePatch}
          />
        </div>
      </div>

      {/* Desired outcome */}
      <div className="form-section">
        <div className="form-section-head">
          <h2>{t('sections.outcome')}</h2>
        </div>
        <div className="form-section-body">
          <EditableField
            path="desiredOutcome.definitionOfGoodEnough"
            label={t('fields.definitionOfGoodEnough')}
            value={draft.desiredOutcome?.definitionOfGoodEnough ?? ''}
            manuallyEdited={mef.includes('desiredOutcome.definitionOfGoodEnough')}
            onPatch={handlePatch}
          />
          <RemovableChip
            path="desiredOutcome.mustHaves"
            label={t('fields.mustHaves')}
            items={draft.desiredOutcome?.mustHaves ?? []}
            onPatch={handlePatchArray}
          />
          <RemovableChip
            path="desiredOutcome.outOfScope"
            label={t('fields.outOfScope')}
            items={draft.desiredOutcome?.outOfScope ?? []}
            onPatch={handlePatchArray}
          />
        </div>
      </div>

      {/* Context */}
      <div className="form-section">
        <div className="form-section-head">
          <h2>{t('sections.context')}</h2>
        </div>
        <div className="form-section-body">
          <EditableField
            path="context.industry"
            label={t('fields.industry')}
            value={draft.context?.industry ?? ''}
            manuallyEdited={mef.includes('context.industry')}
            onPatch={handlePatch}
          />
          <div className="form-field">
            <span className="form-label">{t('fields.technicalLevel')}</span>
            <select
              className="form-input"
              value={draft.context?.technicalLevel ?? ''}
              onChange={(e) => handleSelect('context.technicalLevel', e.target.value)}
            >
              <option value="">—</option>
              <option value="non_technical">non-technical</option>
              <option value="semi_technical">semi-technical</option>
              <option value="developer">developer</option>
            </select>
          </div>
          <RemovableChip
            path="context.existingStack"
            label={t('fields.stack')}
            items={draft.context?.existingStack ?? []}
            onPatch={handlePatchArray}
          />
        </div>
      </div>

      {/* Constraints */}
      <div className="form-section">
        <div className="form-section-head">
          <h2>{t('sections.constraints')}</h2>
        </div>
        <div className="form-section-body">
          <div className="form-field">
            <span className="form-label">{t('fields.budget')}</span>
            <select
              className="form-input"
              value={draft.constraints?.budgetBand ?? ''}
              onChange={(e) => handleSelect('constraints.budgetBand', e.target.value)}
            >
              <option value="">—</option>
              <option value="exploratory">exploratory</option>
              <option value="lt_500">&lt; $500</option>
              <option value="from_500_2k">$500 – $2k</option>
              <option value="from_2k_10k">$2k – $10k</option>
              <option value="gt_10k">&gt; $10k</option>
              <option value="open">open</option>
            </select>
          </div>
          <div className="form-field">
            <span className="form-label">{t('fields.timeline')}</span>
            <select
              className="form-input"
              value={draft.constraints?.timeline ?? ''}
              onChange={(e) => handleSelect('constraints.timeline', e.target.value)}
            >
              <option value="">—</option>
              <option value="asap">asap</option>
              <option value="weeks">weeks</option>
              <option value="months">months</option>
              <option value="no_rush">no rush</option>
            </select>
          </div>
          <div className="form-field">
            <span className="form-label">{t('fields.licensing')}</span>
            <select
              className="form-input"
              value={draft.constraints?.licensing ?? 'no_pref'}
              onChange={(e) => handleSelect('constraints.licensing', e.target.value)}
            >
              <option value="no_pref">no preference</option>
              <option value="saas_ok">SaaS ok</option>
              <option value="self_hosted_only">self-hosted only</option>
              <option value="oss_only">open-source only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Solution type */}
      <div className="form-section">
        <div className="form-section-head">
          <h2>{t('sections.solutionType')}</h2>
        </div>
        <div className="form-section-body">
          <RemovableChip
            path="preferredSolutionType"
            label={t('sections.solutionType')}
            items={draft.preferredSolutionType ?? []}
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
