'use client';

// Component 5 — priority_ranking (§3.1.5). Verbatim prototype-port of the
// `.rui-priority-ranking` / `.rui-pr-*` markup from refiner-ui-catalog.html.
// Drag-to-rank (HTML5 DnD, no new deps) with the handle as the affordance;
// output is { ranked: string[] } ordered highest-priority-first. No Tailwind.

import { useState } from 'react';
import type { ComponentMode, PriorityRankingProps, PriorityRankingOutput } from './types';

type Props = PriorityRankingProps & ComponentMode;

export function PriorityRanking(props: Props) {
  const { prompt, items } = props;
  const [order, setOrder] = useState<string[]>(() => items.map((i) => i.id));
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const byId = (id: string) => items.find((i) => i.id === id);

  // ── Frozen — render the locked order ──
  if (props.frozen) {
    const output = props.output as PriorityRankingOutput;
    const ranked = output.ranked?.length ? output.ranked : items.map((i) => i.id);
    return (
      <div className="rui-priority-ranking">
        <p className="rui-pr-prompt">{prompt}</p>
        <div className="rui-pr-list">
          {ranked.map((id, idx) => (
            <div key={id} className="rui-pr-item" style={{ cursor: 'default' }}>
              <div className="rui-pr-number">{idx + 1}</div>
              <span className="rui-pr-text">{byId(id)?.label ?? id}</span>
              <span className="rui-pr-handle">⋮⋮</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function reorder(dragId: string, overId: string) {
    if (dragId === overId) return;
    setOrder((prev) => {
      const next = prev.filter((id) => id !== dragId);
      const overIndex = next.indexOf(overId);
      next.splice(overIndex, 0, dragId);
      return next;
    });
  }

  function move(id: string, dir: -1 | 1) {
    setOrder((prev) => {
      const idx = prev.indexOf(id);
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  const { onSubmit } = props;

  function submit() {
    const output: PriorityRankingOutput = { ranked: order };
    onSubmit(output);
  }

  return (
    <div className="rui-priority-ranking">
      <p className="rui-pr-prompt">{prompt}</p>
      <div className="rui-pr-list">
        {order.map((id, idx) => (
          <div
            key={id}
            className="rui-pr-item"
            draggable={!props.disabled}
            onDragStart={() => setDraggingId(id)}
            onDragEnd={() => setDraggingId(null)}
            onDragOver={(e) => {
              e.preventDefault();
              if (draggingId && draggingId !== id) reorder(draggingId, id);
            }}
          >
            <div className="rui-pr-number">{idx + 1}</div>
            <span className="rui-pr-text">{byId(id)?.label ?? id}</span>
            <span
              className="rui-pr-handle"
              role="button"
              aria-label="reorder"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  move(id, -1);
                } else if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  move(id, 1);
                }
              }}
            >
              ⋮⋮
            </span>
          </div>
        ))}
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
