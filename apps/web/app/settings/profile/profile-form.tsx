'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { UpdateProfileInput, type UpdateProfileInputType } from '@/lib/zod/profile';
import { updateProfile } from '@/lib/actions/profile';

interface Props {
  initial: UpdateProfileInputType;
}

export function ProfileForm({ initial }: Props) {
  const { register, handleSubmit, formState } = useForm<UpdateProfileInputType>({
    resolver: zodResolver(UpdateProfileInput),
    defaultValues: initial,
  });
  const [serverError, setServerError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function onSubmit(values: UpdateProfileInputType) {
    setServerError(null);
    const result = await updateProfile(values);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    setSavedAt(Date.now());
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.5rem',
    fontSize: '1rem',
    border: '1px solid #ccc',
    borderRadius: 8,
    marginTop: 4,
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
    >
      <label>
        Display name
        <input {...register('display_name')} style={inputStyle} />
        {formState.errors.display_name && (
          <small style={{ color: 'crimson' }}>{formState.errors.display_name.message}</small>
        )}
      </label>

      <label>
        Bio
        <textarea {...register('bio')} rows={3} style={inputStyle} />
        {formState.errors.bio && (
          <small style={{ color: 'crimson' }}>{formState.errors.bio.message}</small>
        )}
      </label>

      <button
        type="submit"
        disabled={formState.isSubmitting}
        style={{
          padding: '0.75rem 1rem',
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
          backgroundColor: '#a855f7',
          color: 'white',
          fontWeight: 600,
        }}
      >
        {formState.isSubmitting ? 'Saving…' : 'Save profile'}
      </button>

      {serverError && <small style={{ color: 'crimson' }}>Error: {serverError}</small>}
      {savedAt && <small style={{ color: 'green' }}>Saved.</small>}
    </form>
  );
}
