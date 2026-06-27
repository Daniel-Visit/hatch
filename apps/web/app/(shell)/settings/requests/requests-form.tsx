'use client';

import { useRef, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import {
  RequestPreferencesInput,
  type RequestPreferencesInputType,
} from '@/lib/zod/request-preferences';
import { updateRequestPreferences } from '@/lib/actions/request-preferences';

interface Props {
  initial: RequestPreferencesInputType;
}

interface ChipEditorProps {
  value: string[];
  onChange: (next: string[]) => void;
  headTitle: string;
  addLabel: string;
}

// Reusable chip editor shared by the "Domains of interest" and "Inferred
// capabilities" cards (mockup #settings). The edit-link reveals a small input;
// Enter (or blur) commits a trimmed, non-empty, non-duplicate chip. Clicking a
// removable tag (the × rendered via .is-removable::after) deletes it.
function ChipEditor({ value, onChange, headTitle, addLabel }: ChipEditorProps) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function startAdd() {
    setAdding(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function commit() {
    const trimmed = draft.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setDraft('');
    setAdding(false);
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div className="capability-editor">
      <div className="capability-editor-head">
        <h5>{headTitle}</h5>
        <span className="edit-link" onClick={startAdd}>
          {addLabel}
        </span>
      </div>
      <div className="capability-tags">
        {value.map((tag, i) => (
          <span
            key={`${tag}-${i}`}
            className="capability-tag is-removable"
            onClick={() => remove(i)}
          >
            {tag}
          </span>
        ))}
        {adding && (
          <input
            ref={inputRef}
            className="btn"
            style={{ height: 28, fontFamily: 'var(--mono)', fontSize: 11 }}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
              } else if (e.key === 'Escape') {
                setDraft('');
                setAdding(false);
              }
            }}
            onBlur={commit}
          />
        )}
      </div>
    </div>
  );
}

export function RequestsForm({ initial }: Props) {
  const t = useTranslations('Wanted.RequestPrefs');
  const { register, handleSubmit, control, formState } = useForm<RequestPreferencesInputType>({
    resolver: zodResolver(RequestPreferencesInput),
    defaultValues: initial,
  });
  const [serverError, setServerError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function onSubmit(values: RequestPreferencesInputType) {
    setServerError(null);
    const r = await updateRequestPreferences(values);
    if (!r.ok) {
      setServerError(r.error);
      return;
    }
    setSavedAt(Date.now());
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="settings-card">
        <h2>{t('receiveTitle')}</h2>
        <p className="lead">{t('receiveLead')}</p>

        <div className="settings-row">
          <label>
            <b>{t('openToBriefs')}</b>
            <i>{t('openToBriefsHelp')}</i>
          </label>
          <Controller
            control={control}
            name="accepts_requests"
            render={({ field }) => (
              <button
                type="button"
                className={field.value ? 'toggle is-on' : 'toggle'}
                onClick={() => field.onChange(!field.value)}
                role="switch"
                aria-checked={field.value}
              />
            )}
          />
        </div>

        <div className="settings-row">
          <label>
            <b>{t('maxConcurrent')}</b>
            <i>{t('maxConcurrentHelp')}</i>
          </label>
          <input
            className="btn"
            style={{ height: 36, width: 80, textAlign: 'center', fontFamily: 'var(--mono)' }}
            type="number"
            min={0}
            max={20}
            {...register('request_capacity', { valueAsNumber: true })}
          />
        </div>

        <div className="settings-row">
          <label>
            <b>{t('rateBand')}</b>
            <i>{t('rateBandHelp')}</i>
          </label>
          <Controller
            control={control}
            name="request_rate_band"
            render={({ field }) => (
              <select
                className="btn"
                style={{ height: 36 }}
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.value === '' ? null : e.target.value)}
              >
                <option value="">{t('rateBandAny')}</option>
                <option value="EXPLORATORY">{t('bandExploratory')}</option>
                <option value="LT_500">{t('bandLt500')}</option>
                <option value="FROM_500_2K">{t('bandFrom500_2k')}</option>
                <option value="FROM_2K_10K">{t('bandFrom2k10k')}</option>
                <option value="GT_10K">{t('bandGt10k')}</option>
                <option value="OPEN">{t('bandOpen')}</option>
              </select>
            )}
          />
        </div>
      </div>

      <div className="settings-card">
        <h2>{t('domainsTitle')}</h2>
        <p className="lead">{t('domainsLead')}</p>
        <Controller
          control={control}
          name="request_domains"
          render={({ field }) => (
            <ChipEditor
              value={field.value}
              onChange={field.onChange}
              headTitle={t('activeDomains')}
              addLabel={t('addChip')}
            />
          )}
        />
      </div>

      <div className="settings-card">
        <h2>{t('capabilitiesTitle')}</h2>
        <p className="lead">{t('capabilitiesLead')}</p>
        <Controller
          control={control}
          name="inferred_capabilities"
          render={({ field }) => (
            <ChipEditor
              value={field.value}
              onChange={field.onChange}
              headTitle={t('fromYourApps')}
              addLabel={t('addChip')}
            />
          )}
        />
      </div>

      <div
        style={{
          maxWidth: 720,
          margin: '16px auto 0',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <button type="submit" className="btn btn-publish btn-lg" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? t('saving') : t('save')}
        </button>
        {serverError && (
          <small style={{ color: 'crimson' }}>{t('errorPrefix', { error: serverError })}</small>
        )}
        {savedAt && <small style={{ color: 'green' }}>{t('saved')}</small>}
      </div>
    </form>
  );
}
