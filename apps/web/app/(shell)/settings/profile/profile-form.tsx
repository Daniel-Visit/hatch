'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { UpdateProfileInput, type UpdateProfileInputType } from '@/lib/zod/profile';
import { updateProfile, uploadAvatar } from '@/lib/actions/profile';
import { BANNER_GRADIENTS, resolveBannerCss } from '@/lib/profile-gradients';

interface Props {
  initial: UpdateProfileInputType;
  initialAvatarUrl: string | null;
}

export function ProfileForm({ initial, initialAvatarUrl }: Props) {
  const { register, handleSubmit, control, watch, formState } = useForm<UpdateProfileInputType>({
    resolver: zodResolver(UpdateProfileInput),
    defaultValues: initial,
  });
  const [serverError, setServerError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [avatarStatus, setAvatarStatus] = useState<'idle' | 'uploading' | 'error'>('idle');
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentHue = watch('hue');
  const currentGradient = watch('banner_gradient');
  const bannerCss = resolveBannerCss(currentGradient, currentHue);

  async function onSubmit(values: UpdateProfileInputType) {
    setServerError(null);
    const result = await updateProfile(values);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    setSavedAt(Date.now());
  }

  async function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarStatus('uploading');
    setAvatarError(null);
    const fd = new FormData();
    fd.append('file', file);
    const res = await uploadAvatar(fd);
    if (!res.ok) {
      setAvatarStatus('error');
      setAvatarError(res.error);
      return;
    }
    setAvatarUrl(res.data.url);
    setAvatarStatus('idle');
    if (fileInputRef.current) fileInputRef.current.value = '';
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
      <div>
        <div style={{ fontWeight: 500, marginBottom: 8 }}>Avatar</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              overflow: 'hidden',
              background: '#eee',
              display: 'grid',
              placeItems: 'center',
              boxShadow: '0 0 0 1px var(--border, #e5e5e5)',
            }}
          >
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt="Your avatar"
                width={72}
                height={72}
                style={{ width: 72, height: 72, objectFit: 'cover' }}
              />
            ) : (
              <span style={{ fontSize: 32, color: '#999' }}>?</span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarStatus === 'uploading'}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #ccc',
                borderRadius: 8,
                cursor: 'pointer',
                backgroundColor: 'white',
                fontSize: 14,
              }}
            >
              {avatarStatus === 'uploading' ? 'Uploading…' : 'Upload new avatar'}
            </button>
            <small style={{ color: '#666' }}>PNG, JPG, WEBP or GIF · up to 2 MB</small>
            {avatarStatus === 'error' && (
              <small style={{ color: 'crimson' }}>Upload failed: {avatarError}</small>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={onAvatarChange}
            style={{ display: 'none' }}
          />
        </div>
      </div>

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
        <div style={{ fontWeight: 500, marginBottom: 8 }}>Banner gradient</div>
        <div
          aria-hidden
          style={{
            height: 80,
            borderRadius: 12,
            background: bannerCss,
            border: '1px solid var(--border, #e5e5e5)',
          }}
        />
        <Controller
          control={control}
          name="banner_gradient"
          render={({ field }) => (
            <div
              role="radiogroup"
              aria-label="Banner gradient"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(6, 1fr)',
                gap: 8,
                marginTop: 10,
              }}
            >
              {BANNER_GRADIENTS.map((g) => {
                const selected = field.value === g.css;
                return (
                  <button
                    key={g.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={g.label}
                    title={g.label}
                    onClick={() => field.onChange(g.css)}
                    style={{
                      aspectRatio: '1 / 1',
                      borderRadius: 10,
                      background: g.css,
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
          Pick one of the presets to set your profile banner.
        </small>
      </div>

      <button
        type="submit"
        disabled={formState.isSubmitting}
        className="btn btn-publish btn-lg"
        style={{ alignSelf: 'flex-start' }}
      >
        {formState.isSubmitting ? 'Saving…' : 'Save profile'}
      </button>

      {serverError && <small style={{ color: 'crimson' }}>Error: {serverError}</small>}
      {savedAt && <small style={{ color: 'green' }}>Saved.</small>}
    </form>
  );
}
