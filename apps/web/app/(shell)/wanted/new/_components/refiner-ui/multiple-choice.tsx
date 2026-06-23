'use client';

// Component 1 — multiple_choice (§3.1.5). Verbatim prototype-port of the
// `.rui-multiple-choice` / `.rui-mc-*` markup (interactive) and `.rui-mc-frozen*`
// (frozen) from refiner-ui-catalog.html + mockups.html. No Tailwind.

import { useState } from 'react';
import type { ComponentMode, MultipleChoiceProps, MultipleChoiceOutput } from './types';

type Props = MultipleChoiceProps & ComponentMode;

export function MultipleChoice(props: Props) {
  const { question, options, multiSelect = false } = props;
  const [selected, setSelected] = useState<string[]>([]);

  // ── Frozen — render the locked selection ──
  if (props.frozen) {
    const output = props.output as MultipleChoiceOutput;
    const chosen = new Set(
      Array.isArray(output.selected) ? output.selected : [output.selected].filter(Boolean),
    );
    return (
      <div className="rui-mc-frozen">
        <p className="rui-mc-frozen-q">{question}</p>
        {options.map((opt) => (
          <div
            key={opt.id}
            className={`rui-mc-frozen-option${chosen.has(opt.id) ? ' is-selected' : ''}`}
          >
            <span className="rui-mc-frozen-dot" />
            <span>
              <b>{opt.label}</b>
              {opt.description ? ` — ${opt.description}` : ''}
            </span>
          </div>
        ))}
        <div className="rui-mc-frozen-marker">✓ multiple_choice · locked</div>
      </div>
    );
  }

  function toggle(id: string) {
    setSelected((prev) => {
      if (multiSelect) {
        return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      }
      return [id];
    });
  }

  const { onSubmit } = props;

  function submit() {
    if (selected.length === 0) return;
    const output: MultipleChoiceOutput = {
      selected: multiSelect ? selected : selected[0],
    };
    onSubmit(output);
  }

  return (
    <div className="rui-multiple-choice">
      <p className="rui-mc-question">{question}</p>
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          className={`rui-mc-option${selected.includes(opt.id) ? ' is-selected' : ''}`}
          onClick={() => toggle(opt.id)}
          disabled={props.disabled}
        >
          <span className="rui-mc-dot" />
          <span className="rui-mc-label">
            <b>{opt.label}</b>
            {opt.description ? <i>{opt.description}</i> : null}
          </span>
        </button>
      ))}
      <button
        type="button"
        className="btn btn-primary"
        style={{ marginTop: 8, alignSelf: 'flex-start' }}
        onClick={submit}
        disabled={props.disabled || selected.length === 0}
      >
        Send →
      </button>
    </div>
  );
}
