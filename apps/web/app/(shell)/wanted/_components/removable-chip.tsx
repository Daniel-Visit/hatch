'use client';

import { useState } from 'react';

type RemovableChipProps = {
  path: string;
  label: string;
  items: string[];
  onPatch: (path: string, value: string[]) => void;
};

export function RemovableChip({ path, label, items, onPatch }: RemovableChipProps) {
  const [adding, setAdding] = useState(false);
  const [newItem, setNewItem] = useState('');

  function remove(item: string) {
    onPatch(
      path,
      items.filter((i) => i !== item),
    );
  }

  function commitAdd() {
    const trimmed = newItem.trim();
    if (trimmed) {
      onPatch(path, [...items, trimmed]);
    }
    setNewItem('');
    setAdding(false);
  }

  function cancelAdd() {
    setNewItem('');
    setAdding(false);
  }

  return (
    <div className="brief-summary-section is-editable">
      <span className="brief-summary-label">{label}</span>
      <div className="brief-summary-chips">
        {items.map((item) => (
          <span className="chip-mini is-removable" key={item}>
            {item}
            <button className="chip-mini-remove" aria-label="remove" onClick={() => remove(item)}>
              ×
            </button>
          </span>
        ))}
        {adding ? (
          <input
            className="chip-mini-input"
            type="text"
            value={newItem}
            autoFocus
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitAdd();
              if (e.key === 'Escape') cancelAdd();
            }}
            onBlur={commitAdd}
          />
        ) : (
          <button className="chip-mini add-chip" onClick={() => setAdding(true)}>
            + add
          </button>
        )}
      </div>
    </div>
  );
}
