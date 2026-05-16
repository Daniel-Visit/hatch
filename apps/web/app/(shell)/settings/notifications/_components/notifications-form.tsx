'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { NotificationPrefsUpdate, type NotificationPrefsT } from '@/lib/zod/notification-prefs';
import { updateNotificationPrefs } from '@/lib/actions/notification-prefs';
import { subscribeToBrowserPush, unsubscribeFromBrowserPush } from '@/lib/push/client';

type Props = {
  initialPrefs: NotificationPrefsT;
};

export function NotificationsForm({ initialPrefs }: Props) {
  const t = useTranslations('Settings.NotificationsForm');
  const [busy, setBusy] = useState(false);

  const { register, watch, handleSubmit, setValue } = useForm<NotificationPrefsT>({
    resolver: zodResolver(NotificationPrefsUpdate),
    defaultValues: initialPrefs,
  });

  const pushEnabled = watch('push_enabled');

  const onMasterToggle = async (newValue: boolean) => {
    setBusy(true);
    setValue('push_enabled', newValue);

    if (newValue) {
      const result = await subscribeToBrowserPush();
      if (!result.ok) {
        setValue('push_enabled', false);
        toast.error(t('CouldNotEnable', { reason: result.reason }));
        setBusy(false);
        return;
      }
    } else {
      await unsubscribeFromBrowserPush();
    }

    // Persist the new master state immediately
    const result = await updateNotificationPrefs({ push_enabled: newValue });
    if (!result.ok) toast.error(t('FailedToast'));
    else toast.success(newValue ? t('EnabledToast') : t('DisabledToast'));
    setBusy(false);
  };

  const onSubmit = async (values: NotificationPrefsT) => {
    setBusy(true);
    const result = await updateNotificationPrefs(values);
    setBusy(false);
    if (result.ok) toast.success(t('SavedToast'));
    else toast.error(t('FailedToast'));
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <Row label={t('EnableMaster')} sub={t('EnableMasterSub')}>
        <Toggle checked={pushEnabled} onChange={(v) => void onMasterToggle(v)} disabled={busy} />
      </Row>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />

      <Row label={t('ContactRequests')} sub={t('ContactRequestsSub')}>
        <input
          type="checkbox"
          {...register('push_contact_requests')}
          disabled={!pushEnabled || busy}
        />
      </Row>
      <Row label={t('Messages')} sub={t('MessagesSub')}>
        <input type="checkbox" {...register('push_messages')} disabled={!pushEnabled || busy} />
      </Row>
      <Row label={t('Comments')} sub={t('CommentsSub')}>
        <input type="checkbox" {...register('push_comments')} disabled={!pushEnabled || busy} />
      </Row>
      <Row label={t('Likes')} sub={t('LikesSub')}>
        <input type="checkbox" {...register('push_likes')} disabled={!pushEnabled || busy} />
      </Row>
      <Row label={t('Follows')} sub={t('FollowsSub')}>
        <input type="checkbox" {...register('push_follows')} disabled={!pushEnabled || busy} />
      </Row>

      <button
        type="submit"
        className="btn btn-publish"
        disabled={busy}
        style={{ marginTop: 16, alignSelf: 'flex-start' }}
      >
        {t('SavePreferences')}
      </button>
    </form>
  );
}

function Row({ label, sub, children }: { label: string; sub: string; children: React.ReactNode }) {
  return (
    <div
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}
    >
      <div>
        <div style={{ fontWeight: 600 }}>{label}</div>
        <div style={{ color: 'var(--text-2)', fontSize: '0.85rem' }}>{sub}</div>
      </div>
      {children}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 18, height: 18 }}
      />
    </label>
  );
}
