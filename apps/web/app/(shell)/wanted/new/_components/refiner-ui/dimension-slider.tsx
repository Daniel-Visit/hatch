'use client';

// Component 4 — dimension_slider (§3.1.5). Verbatim prototype-port of the
// `.rui-dimension-slider` / `.rui-ds-*` markup from refiner-ui-catalog.html.
// 5 discrete stops; output is { dimension, position, label }. No Tailwind.

import { useState } from 'react';
import type { ComponentMode, DimensionSliderProps, DimensionSliderOutput } from './types';

type Props = DimensionSliderProps & ComponentMode;

export function DimensionSlider(props: Props) {
  const { dimension, prompt, leftAnchor, rightAnchor, stops } = props;
  const [position, setPosition] = useState<number | null>(null);

  const labelFor = (pos: number | null): string =>
    pos === null ? '' : (stops.find((s) => s.position === pos)?.label ?? '');

  // ── Frozen ──
  if (props.frozen) {
    const output = props.output as DimensionSliderOutput;
    const current = output.position;
    return (
      <div className="rui-dimension-slider">
        <p className="rui-ds-prompt">{prompt}</p>
        <div className="rui-ds-axis">
          <div className="rui-ds-axis-line" />
          {stops.map((s) => (
            <span
              key={s.position}
              className={`rui-ds-stop${s.position === current ? ' is-current' : ''}`}
            >
              {s.position + 1}
            </span>
          ))}
        </div>
        <div className="rui-ds-anchors">
          <span className="rui-ds-anchor-left">{leftAnchor}</span>
          <span className="rui-ds-anchor-right">{rightAnchor}</span>
        </div>
        <span className="rui-ds-current-label">{output.label || labelFor(current)}</span>
      </div>
    );
  }

  const { onSubmit } = props;

  function submit() {
    if (position === null) return;
    const output: DimensionSliderOutput = {
      dimension,
      position,
      label: labelFor(position),
    };
    onSubmit(output);
  }

  return (
    <div className="rui-dimension-slider">
      <p className="rui-ds-prompt">{prompt}</p>
      <div className="rui-ds-axis">
        <div className="rui-ds-axis-line" />
        {stops.map((s) => (
          <button
            key={s.position}
            type="button"
            className={`rui-ds-stop${s.position === position ? ' is-current' : ''}`}
            onClick={() => setPosition(s.position)}
            disabled={props.disabled}
          >
            {s.position + 1}
          </button>
        ))}
      </div>
      <div className="rui-ds-anchors">
        <span className="rui-ds-anchor-left">{leftAnchor}</span>
        <span className="rui-ds-anchor-right">{rightAnchor}</span>
      </div>
      {position !== null && <span className="rui-ds-current-label">{labelFor(position)}</span>}
      <button
        type="button"
        className="btn btn-primary"
        style={{ alignSelf: 'flex-start' }}
        onClick={submit}
        disabled={props.disabled || position === null}
      >
        Send →
      </button>
    </div>
  );
}
