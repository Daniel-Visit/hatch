'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { UpdateProfileInput, type UpdateProfileInputType } from '@/lib/zod/profile';
import { updateProfile } from '@/lib/actions/profile';

interface Props {
  initial: UpdateProfileInputType;
}

// 12 hue stops at 30° intervals — covers the full spectrum smoothly.
const HUE_STOPS = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

export function ProfileForm({ initial }: Props) {
  const { register, handleSubmit, control, watch, formState } = useForm<UpdateProfileInputType>({
    resolver: zodResolver(UpdateProfileInput),
    defaultValues: initial,
  });
  const [serverError, setServerError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const currentHue = watch('hue');

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

  const bannerGradient = (hue: number) =>
    `linear-gradient(135deg, oklch(72% 0.18 ${hue}), oklch(60% 0.22 ${(hue + 60) % 360}))`;

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

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontWeight: 500 }}>Banner color</span>
          <small style={{ color: '#666' }}>Hue {currentHue}°</small>
        </div>
        <div
          aria-hidden
          style={{
            marginTop: 8,
            height: 80,
            borderRadius: 12,
            background: bannerGradient(currentHue),
            border: '1px solid var(--border, #e5e5e5)',
          }}
        />
        <Controller
          control={control}
          name="hue"
          render={({ field }) => (
            <div
              role="radiogroup"
              aria-label="Banner color"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(12, 1fr)',
                gap: 6,
                marginTop: 10,
              }}
            >
              {HUE_STOPS.map((h) => {
                const selected = field.value === h;
                return (
                  <button
                    key={h}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={`Hue ${h} degrees`}
                    onClick={() => field.onChange(h)}
                    style={{
                      aspectRatio: '1 / 1',
                      borderRadius: 8,
                      background: bannerGradient(h),
                      border: selected ? '2px solid var(--text, #000)' : '1px solid transparent',
                      boxShadow: selected ? '0 0 0 2px var(--surface, #fff)' : 'none',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  />
                );
              })}
            </div>
          )}
        />
        <small style={{ color: '#666', display: 'block', marginTop: 6 }}>
          The gradient on your profile banner and the tint behind your avatar.
        </small>
      </div>

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
