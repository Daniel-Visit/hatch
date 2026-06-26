'use client';

// Component 3 — negative_picker (§3.1.5). Highest-leverage tool. Verbatim
// prototype-port of the `.rui-negative-picker` / `.rui-np-*` markup from
// refiner-ui-catalog.html. Cards toggle excluded; output is { excluded }.
// No Tailwind.

import { useState } from 'react';
import type { ComponentMode, NegativePickerProps, NegativePickerOutput } from './types';

type Props = NegativePickerProps & ComponentMode;

const FALLBACK_GLYPH = '◐';

export function NegativePicker(props: Props) {
  const { prompt, apps = [] } = props;
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  // ── Frozen ──
  if (props.frozen) {
    const output = props.output as NegativePickerOutput;
    const ex = new Set(output.excluded ?? []);
    return (
      <div className="rui-negative-picker">
        <p className="rui-np-prompt">{prompt}</p>
        <div className="rui-np-grid">
          {apps.map((app) => (
            <div key={app.id} className={`rui-np-card${ex.has(app.id) ? ' is-excluded' : ''}`}>
              <div className="glyph">{app.glyph ?? FALLBACK_GLYPH}</div>
              <h4>{app.name}</h4>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const { onSubmit } = props;

  function toggle(id: string) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit() {
    const output: NegativePickerOutput = { excluded: Array.from(excluded) };
    onSubmit(output);
  }

  return (
    <div className="rui-negative-picker">
      <p className="rui-np-prompt">{prompt}</p>
      <div className="rui-np-grid">
        {apps.map((app) => (
          <button
            key={app.id}
            type="button"
            className={`rui-np-card${excluded.has(app.id) ? ' is-excluded' : ''}`}
            onClick={() => toggle(app.id)}
            disabled={props.disabled}
            style={{ font: 'inherit' }}
          >
            <div className="glyph">{app.glyph ?? FALLBACK_GLYPH}</div>
            <h4>{app.name}</h4>
          </button>
        ))}
      </div>
      <p className="rui-np-hint">Pick none if all of them could work. Pick all if none fit.</p>
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
