'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { subscribeToBrowserPush } from '@/lib/push/client';
import { toast } from 'sonner';

const DISMISSED_KEY = 'hatch-push-prompt-dismissed';

type PushPermissionPromptProps = {
  hasPushEnabled: boolean;
};

export function PushPermissionPrompt({ hasPushEnabled }: PushPermissionPromptProps) {
  const t = useTranslations('Push');
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (typeof Notification === 'undefined') return; // unsupported browser
    if (hasPushEnabled) return; // already opted in (DB pref)
    if (Notification.permission !== 'default') return; // already granted or denied
    if (localStorage.getItem(DISMISSED_KEY) === '1') return;
    setShow(true);
  }, [hasPushEnabled]);

  if (!show) return null;

  const onEnable = async () => {
    const result = await subscribeToBrowserPush();
    if (result.ok) {
      toast.success(t('EnabledToast'));
      setShow(false);
    } else {
      toast.error(t('CouldNotEnable', { reason: result.reason }));
    }
  };

  const onDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setShow(false);
  };

  return (
    <div className="push-prompt" role="dialog" aria-label={t('AriaLabel')}>
      <p>{t('EnableNotifications')}</p>
      <div className="push-prompt-actions">
        <button type="button" className="btn btn-publish" onClick={onEnable}>
          {t('EnableButton')}
        </button>
        <button type="button" className="btn btn-ghost-2" onClick={onDismiss}>
          {t('MaybeLater')}
        </button>
      </div>
    </div>
  );
}
