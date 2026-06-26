'use client';

// Component 2 — app_comparison (§3.1.5). Verbatim prototype-port of the
// `.rui-app-comparison` / `.rui-ac-*` markup from refiner-ui-catalog.html. Each
// card toggles similar / not / neutral; output is { similarTo, notSimilarTo }.
// No Tailwind.

import { useState } from 'react';
import type { ComponentMode, AppComparisonProps, AppComparisonOutput } from './types';

type Props = AppComparisonProps & ComponentMode;

type Mark = 'similar' | 'not' | 'neutral';

const FALLBACK_GLYPH = '◍';

export function AppComparison(props: Props) {
  const { category, contextHint, apps = [] } = props;
  const [marks, setMarks] = useState<Record<string, Mark>>({});

  const prompt =
    contextHint ?? `For "${category}" — which of these is closest to what you imagine?`;

  // ── Frozen ──
  if (props.frozen) {
    const output = props.output as AppComparisonOutput;
    const similar = new Set(output.similarTo ?? []);
    const notSimilar = new Set(output.notSimilarTo ?? []);
    return (
      <div className="rui-app-comparison">
        <p className="rui-ac-prompt">{prompt}</p>
        <div className="rui-ac-grid">
          {apps.map((app) => {
            const cls = similar.has(app.id)
              ? ' is-similar'
              : notSimilar.has(app.id)
                ? ' is-not-similar'
                : '';
            return (
              <div key={app.id} className={`rui-ac-card${cls}`}>
                {similar.has(app.id) && <span className="rui-ac-marker">✓</span>}
                {notSimilar.has(app.id) && <span className="rui-ac-marker">✕</span>}
                <div className="glyph">{app.glyph ?? FALLBACK_GLYPH}</div>
                <h4>{app.name}</h4>
                {app.tagline ? <p>{app.tagline}</p> : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const { onSubmit } = props;

  function setMark(id: string, mark: Mark) {
    setMarks((prev) => ({ ...prev, [id]: prev[id] === mark ? 'neutral' : mark }));
  }

  function submit() {
    const output: AppComparisonOutput = {
      similarTo: apps.filter((a) => marks[a.id] === 'similar').map((a) => a.id),
      notSimilarTo: apps.filter((a) => marks[a.id] === 'not').map((a) => a.id),
    };
    onSubmit(output);
  }

  return (
    <div className="rui-app-comparison">
      <p className="rui-ac-prompt">{prompt}</p>
      <div className="rui-ac-grid">
        {apps.map((app) => {
          const mark = marks[app.id] ?? 'neutral';
          const cls = mark === 'similar' ? ' is-similar' : mark === 'not' ? ' is-not-similar' : '';
          return (
            <div key={app.id} className={`rui-ac-card${cls}`}>
              {mark === 'similar' && <span className="rui-ac-marker">✓</span>}
              {mark === 'not' && <span className="rui-ac-marker">✕</span>}
              <div className="glyph">{app.glyph ?? FALLBACK_GLYPH}</div>
              <h4>{app.name}</h4>
              {app.tagline ? <p>{app.tagline}</p> : null}
              <div className="rui-ac-toggle">
                <button
                  type="button"
                  className="yes"
                  onClick={() => setMark(app.id, 'similar')}
                  disabled={props.disabled}
                >
                  Similar
                </button>
                <button
                  type="button"
                  className="no"
                  onClick={() => setMark(app.id, 'not')}
                  disabled={props.disabled}
                >
                  Not
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        className="btn btn-primary"
        style={{ alignSelf: 'flex-start' }}
        onClick={submit}
        disabled={props.disabled}
      >
        Send →
      </button>
    </div>
  );
}
