'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { NotificationPrefsUpdate, type NotificationPrefsT } from '@/lib/zod/notification-prefs';
import { updateNotificationPrefs } from '@/lib/actions/notification-prefs';
import { subscribeToBrowserPush, unsubscribeFromBrowserPush } from '@/lib/push/client';

type Props = {
  initialPrefs: NotificationPrefsT;
};

export function NotificationsForm({ initialPrefs }: Props) {
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
        toast.error(`Could not enable: ${result.reason}`);
        setBusy(false);
        return;
      }
    } else {
      await unsubscribeFromBrowserPush();
    }

    // Persist the new master state immediately
    const result = await updateNotificationPrefs({ push_enabled: newValue });
    if (!result.ok) toast.error('Failed to save');
    else toast.success(newValue ? 'Browser notifications on' : 'Browser notifications off');
    setBusy(false);
  };

  const onSubmit = async (values: NotificationPrefsT) => {
    setBusy(true);
    const result = await updateNotificationPrefs(values);
    setBusy(false);
    if (result.ok) toast.success('Saved');
    else toast.error('Failed to save');
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <Row label="Enable browser notifications" sub="Required for any push to reach you off-site.">
        <Toggle checked={pushEnabled} onChange={(v) => void onMasterToggle(v)} disabled={busy} />
      </Row>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />

      <Row label="Contact requests" sub="When someone wants to reach out about your app">
        <input
          type="checkbox"
          {...register('push_contact_requests')}
          disabled={!pushEnabled || busy}
        />
      </Row>
      <Row label="Messages" sub="New messages in an active conversation">
        <input type="checkbox" {...register('push_messages')} disabled={!pushEnabled || busy} />
      </Row>
      <Row label="Comments" sub="When someone comments on your app">
        <input type="checkbox" {...register('push_comments')} disabled={!pushEnabled || busy} />
      </Row>
      <Row label="Likes" sub="When someone likes your app">
        <input type="checkbox" {...register('push_likes')} disabled={!pushEnabled || busy} />
      </Row>
      <Row label="Follows" sub="When someone follows you">
        <input type="checkbox" {...register('push_follows')} disabled={!pushEnabled || busy} />
      </Row>

      <button
        type="submit"
        className="btn btn-publish"
        disabled={busy}
        style={{ marginTop: 16, alignSelf: 'flex-start' }}
      >
        Save preferences
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
