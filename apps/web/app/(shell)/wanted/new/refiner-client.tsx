'use client';

// Wanted Refiner — client orchestrator.
//
// Wires together the transcript, composer, and brief-summary panel against the
// REST + SSE backend. State machine:
//
//   idle      → no stream in flight; composer enabled, no approve callout.
//   streaming → an SSE refine turn is in flight; composer disabled.
//   ready     → the agent signalled shouldStop; approve callout is shown.
//   approved  → the brief was approved; matching has started.
//
// Flow: first user message lazily creates a brief (POST /api/v1/briefs), then
// each turn streams via streamRefine. Manual field edits autosave through
// PATCH /api/v1/briefs/:id/content. Approve calls POST .../approve.

import { useCallback, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { type BriefContent, BriefContentSchema, REFINER_MAX_TURNS } from '@hatch/shared';
import { applyDraftPatch, setContentPath } from '@/lib/wanted/brief-state';
import { streamRefine } from './_lib/sse-client';
import { RefinerTranscript, type RefinerTurn } from './_components/refiner-transcript';
import { RefinerComposer } from './_components/refiner-composer';
import { BriefSummaryPanel } from '../_components/brief-summary-panel';
import type { UiOutput } from './_components/refiner-ui/types';

type Phase = 'idle' | 'streaming' | 'ready' | 'approved';

export function RefinerClient() {
  const t = useTranslations('Wanted');

  const [, setBriefId] = useState<string | null>(null);
  const [turns, setTurns] = useState<RefinerTurn[]>([]);
  const [draft, setDraft] = useState<BriefContent>(() => BriefContentSchema.parse({}));
  const [completeness, setCompleteness] = useState(0);
  const [manuallyEditedFields, setManuallyEditedFields] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [turnCount, setTurnCount] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  // True while a ui_response submit + resume stream is in flight (disables the
  // interactive UI component so it can't be double-submitted).
  const [uiBusy, setUiBusy] = useState(false);

  // Ref mirror of briefId so handlers created in one render can read the latest
  // value without a stale closure (e.g. autosave fired right after the first
  // turn creates the brief).
  const briefIdRef = useRef<string | null>(null);

  // Append a streamed token delta to the last (streaming) agent bubble.
  const appendDelta = useCallback((delta: string) => {
    setTurns((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      if (last.role !== 'agent') return prev;
      const next = prev.slice(0, -1);
      next.push({ ...last, content: last.content + delta });
      return next;
    });
  }, []);

  // Mark the last agent bubble as no longer streaming.
  const finishAgentBubble = useCallback(() => {
    setTurns((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      if (last.role !== 'agent') return prev;
      const next = prev.slice(0, -1);
      next.push({ ...last, streaming: false });
      return next;
    });
  }, []);

  // Attach a declarative UI invocation to the last (current) agent bubble so it
  // renders an interactive component below the agent's text (§4.4.0a).
  const attachUiCall = useCallback(
    (turnId: string, component: string, props: Record<string, unknown>) => {
      setTurns((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        if (last.role !== 'agent') return prev;
        const next = prev.slice(0, -1);
        next.push({ ...last, uiCall: { turnId, component, props } });
        return next;
      });
    },
    [],
  );

  // Freeze a UI component once the seeker submits — record the output so the
  // transcript re-renders it in its locked, non-interactive state.
  const freezeUiCall = useCallback((turnId: string, output: UiOutput) => {
    setTurns((prev) =>
      prev.map((turn) =>
        turn.uiCall && turn.uiCall.turnId === turnId
          ? { ...turn, uiCall: { ...turn.uiCall, output } }
          : turn,
      ),
    );
  }, []);

  // Consume one refine SSE stream for `text`. Shared by handleSend (free text)
  // and the ui_response resume path (synthesized message). Returns nothing; all
  // effects flow through the handlers + setters.
  const runStream = useCallback(
    async (id: string, text: string) => {
      let sawDone = false;
      await streamRefine(id, text, {
        onToken: ({ delta }) => appendDelta(delta),
        onStructuredUpdate: ({ patch }) => {
          setDraft((d) => applyDraftPatch(d, patch as Partial<BriefContent>));
        },
        onCompleteness: ({ score }) => setCompleteness(score),
        onUiCall: ({ turnId, component, props }) => {
          // The agent asked a UI question — finalize its text bubble, then attach
          // the interactive component. The conversation pauses for the response.
          finishAgentBubble();
          attachUiCall(turnId, component, props);
        },
        onDone: ({ shouldStop, nextAction }) => {
          sawDone = true;
          finishAgentBubble();
          // await_ui_response keeps the composer hidden (the user answers via the
          // component); otherwise idle/ready per the agent's request.
          if (nextAction === 'await_ui_response') {
            setPhase('idle');
          } else {
            setPhase(shouldStop ? 'ready' : 'idle');
          }
        },
        onError: () => {
          finishAgentBubble();
          setPhase('idle');
          setNotice(t('approve.keepTalking'));
        },
      });
      if (!sawDone) {
        finishAgentBubble();
        setPhase((p) => (p === 'streaming' ? 'idle' : p));
      }
    },
    [appendDelta, attachUiCall, finishAgentBubble, t],
  );

  const handleSend = useCallback(
    async (text: string) => {
      setNotice(null);

      // Push the user's message and an empty streaming agent bubble.
      setTurns((prev) => [
        ...prev,
        { role: 'user', content: text },
        { role: 'agent', content: '', streaming: true },
      ]);
      setTurnCount((n) => n + 1);
      setPhase('streaming');

      // Lazily create the brief on the first turn.
      let id = briefIdRef.current;
      if (!id) {
        try {
          const res = await fetch('/api/v1/briefs', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ mode: 'chat' }),
          });
          if (!res.ok) {
            throw new Error(`create failed: ${res.status}`);
          }
          const j = (await res.json()) as { briefId: string };
          id = j.briefId;
          briefIdRef.current = id;
          setBriefId(id);
        } catch {
          finishAgentBubble();
          setPhase('idle');
          setNotice(t('approve.keepTalking'));
          return;
        }
      }

      // Stream the refine turn through the shared consumer.
      await runStream(id, text);
    },
    [finishAgentBubble, runStream, t],
  );

  // Submit a UI component's output (§3.1.5.2): POST /ui-response, freeze the
  // component, then resume the conversation by re-opening /refine with the
  // synthesized user message the endpoint returns. The 3-per-session cap is
  // enforced server-side; surface its error gracefully.
  const handleUiSubmit = useCallback(
    async (turnId: string, component: string, output: UiOutput) => {
      const id = briefIdRef.current;
      if (!id || uiBusy) return;
      setNotice(null);
      setUiBusy(true);

      let synthesized: string;
      try {
        const res = await fetch(`/api/v1/briefs/${id}/turns/${turnId}/ui-response`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ component, output }),
        });
        if (!res.ok) {
          // Failures (incl. 409 ui_invocation_cap_exceeded — the 3-per-session
          // cap): keep the component interactive, surface a soft notice.
          setNotice(t('approve.keepTalking'));
          setUiBusy(false);
          return;
        }
        const j = (await res.json()) as { synthesizedUserMessage: string };
        synthesized = j.synthesizedUserMessage;
      } catch {
        setNotice(t('approve.keepTalking'));
        setUiBusy(false);
        return;
      }

      // Freeze the component (record the output) and show the synthesized user
      // turn, then a fresh streaming agent bubble for the resume.
      freezeUiCall(turnId, output);
      setTurns((prev) => [
        ...prev,
        { role: 'user', content: synthesized },
        { role: 'agent', content: '', streaming: true },
      ]);
      setTurnCount((n) => n + 1);
      setPhase('streaming');

      await runStream(id, synthesized);
      setUiBusy(false);
    },
    [uiBusy, freezeUiCall, runStream, t],
  );

  // Autosave a single scalar field edit (optimistic + persisted).
  const handlePatch = useCallback(async (path: string, value: string) => {
    const id = briefIdRef.current;
    // Optimistic local update.
    setDraft((d) => setContentPath(d, path, value));
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
      // Optimistic value remains; server reconciles on next successful patch.
    }
  }, []);

  // Autosave an array field edit (chips). Same logic, array-valued.
  const handlePatchArray = useCallback(async (path: string, value: string[]) => {
    const id = briefIdRef.current;
    setDraft((d) => setContentPath(d, path, value));
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

  const handleApprove = useCallback(async () => {
    const id = briefIdRef.current;
    if (!id) return;
    try {
      await fetch(`/api/v1/briefs/${id}/approve`, { method: 'POST' });
    } catch {
      // Surface a soft notice but still transition — matching may have started.
      setNotice(t('approve.keepTalking'));
    }
    setPhase('approved');
  }, [t]);

  const hasEdits = manuallyEditedFields.length > 0;

  return (
    <div className="refiner">
      <div className="refiner-chat">
        <RefinerTranscript
          turns={turns}
          turnCounter={{ current: turnCount, max: REFINER_MAX_TURNS }}
          onUiSubmit={handleUiSubmit}
          uiBusy={uiBusy}
        />

        {notice && (
          <div className="refiner-bubble is-agent" role="status">
            <div className="refiner-bubble-avatar">!</div>
            <div className="refiner-bubble-content">{notice}</div>
          </div>
        )}

        {phase === 'ready' && (
          <div className={`refiner-approve${hasEdits ? ' has-edits' : ''}`}>
            <div className="refiner-approve-icon">✓</div>
            <div className="refiner-approve-text">
              {t('approve.ready', { score: completeness.toFixed(2) })}
              {hasEdits && (
                <span className="refiner-approve-edits-tag">
                  {t('approve.editsTag', { n: manuallyEditedFields.length })}
                </span>
              )}
              <br />
              <span
                style={{
                  fontSize: '11.5px',
                  color: 'var(--muted)',
                  fontFamily: 'var(--mono)',
                }}
              >
                {t('approve.autosaved')}
              </span>
            </div>
            <div className="refiner-approve-actions">
              <button className="btn btn-ghost-2" onClick={() => setPhase('idle')}>
                {t('approve.keepTalking')}
              </button>
              <button className="btn btn-primary" onClick={handleApprove}>
                {t('approve.cta')}
              </button>
            </div>
          </div>
        )}

        {phase === 'approved' ? (
          <div className="refiner-approve">
            <div className="refiner-approve-icon">✓</div>
            <div className="refiner-approve-text">
              <b>{t('approved.title')}</b>
              <br />
              {t('approved.body')}
            </div>
          </div>
        ) : (
          <RefinerComposer onSend={handleSend} disabled={phase === 'streaming'} />
        )}
      </div>

      <BriefSummaryPanel
        draft={draft}
        completeness={completeness}
        manuallyEditedFields={manuallyEditedFields}
        onPatch={handlePatch}
        onPatchArray={handlePatchArray}
      />
    </div>
  );
}
