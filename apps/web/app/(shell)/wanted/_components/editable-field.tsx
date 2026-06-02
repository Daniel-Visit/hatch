'use client';

import { useState } from 'react';

type EditableFieldProps = {
  path: string;
  label: string;
  value: string;
  emptyHint?: string;
  manuallyEdited?: boolean;
  onPatch: (path: string, value: string) => void;
};

export function EditableField({
  path,
  label,
  value,
  emptyHint = '—',
  manuallyEdited = false,
  onPatch,
}: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function enterEdit() {
    setDraft(value);
    setEditing(true);
  }

  function cancel() {
    setDraft(value);
    setEditing(false);
  }

  function save() {
    onPatch(path, draft);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="brief-summary-section is-editing">
        <span className="brief-summary-label">{label}</span>
        <textarea
          className="inline-edit-input"
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoFocus
        />
        <div className="inline-edit-actions">
          <button className="btn-mini btn-cancel" onClick={cancel}>
            Cancel
          </button>
          <button className="btn-mini btn-save" onClick={save}>
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`brief-summary-section is-editable${manuallyEdited ? ' is-edited-manually' : ''}`}
      onClick={enterEdit}
    >
      <span className="brief-summary-label">{label}</span>
      <span className={`brief-summary-value${value ? '' : ' empty'}`}>{value || emptyHint}</span>
      <span className="edit-pencil">✎</span>
    </div>
  );
}
