'use client';

// Component 6 — budget_picker (§3.1.5). Verbatim prototype-port of the
// `.rui-budget-picker` / `.rui-bp-*` markup from refiner-ui-catalog.html. Fixed
// five bands with per-band context hints; output is { band }. No props from the
// agent (fixed enum). No Tailwind.

import { useState } from 'react';
import type { ComponentMode, BudgetPickerOutput } from './types';

type Band = BudgetPickerOutput['band'];

const BANDS: Array<{ band: Band; range: string; desc: string; pill: string }> = [
  {
    band: 'EXPLORATORY',
    range: 'Exploratory',
    desc: 'Just curious — no budget allocated yet. Builders may pitch hobby projects.',
    pill: 'free',
  },
  {
    band: 'LT_500',
    range: '< $500',
    desc: 'Tip-jar / coffee money. Suitable for builders treating this as practice.',
    pill: 'hobby',
  },
  {
    band: 'FROM_500_2K',
    range: '$500 – $2k',
    desc: 'Weekend-build territory. Most indie builders engage at this band.',
    pill: 'side-project',
  },
  {
    band: 'FROM_2K_10K',
    range: '$2k – $10k',
    desc: 'Multi-week commitment. Quality bar rises; expect contracts and milestones.',
    pill: 'freelance',
  },
  {
    band: 'GT_10K',
    range: '> $10k',
    desc: 'Studio territory. Smaller pool of builders; longer engagement model.',
    pill: 'studio',
  },
  {
    band: 'OPEN',
    range: 'Open',
    desc: 'No budget ceiling specified.',
    pill: 'open',
  },
];

type Props = ComponentMode;

export function BudgetPicker(props: Props) {
  const [selected, setSelected] = useState<Band | null>(null);

  // ── Frozen ──
  if (props.frozen) {
    const output = props.output as BudgetPickerOutput;
    return (
      <div className="rui-budget-picker">
        <p className="rui-bp-prompt">Where does this sit for you?</p>
        {BANDS.map((b) => (
          <div
            key={b.band}
            className={`rui-bp-band${b.band === output.band ? ' is-selected' : ''}`}
          >
            <span className="rui-bp-range">{b.range}</span>
            <span className="rui-bp-desc">{b.desc}</span>
            <span className="rui-bp-pill">{b.pill}</span>
          </div>
        ))}
      </div>
    );
  }

  const { onSubmit } = props;

  function submit(band: Band) {
    setSelected(band);
    const output: BudgetPickerOutput = { band };
    onSubmit(output);
  }

  return (
    <div className="rui-budget-picker">
      <p className="rui-bp-prompt">Where does this sit for you?</p>
      {BANDS.map((b) => (
        <button
          key={b.band}
          type="button"
          className={`rui-bp-band${b.band === selected ? ' is-selected' : ''}`}
          onClick={() => submit(b.band)}
          disabled={props.disabled}
        >
          <span className="rui-bp-range">{b.range}</span>
          <span className="rui-bp-desc">{b.desc}</span>
          <span className="rui-bp-pill">{b.pill}</span>
        </button>
      ))}
    </div>
  );
}
