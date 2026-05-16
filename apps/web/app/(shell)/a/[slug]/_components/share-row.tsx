'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

type ShareRowProps = {
  title: string;
  tagline: string;
};

/**
 * Share controls on the detail page. Wires four prototype-styled buttons to
 * real client-side behavior:
 *   - "Copy link"        → navigator.clipboard.writeText(window.location.href)
 *   - "𝕏" (X / Twitter)   → opens https://twitter.com/intent/tweet with text + url
 *   - "↗" (native share) → navigator.share({ title, text, url }), falls back to copy
 *   - "⌬" (open in new)   → window.open(url, '_blank')
 *
 * Keeps the prototype class names verbatim so CSS in styles-screens.css applies
 * untouched.
 */
export function ShareRow({ title, tagline }: ShareRowProps) {
  const t = useTranslations('Detail');
  const [copied, setCopied] = useState(false);

  function getUrl(): string {
    if (typeof window === 'undefined') return '';
    return window.location.href;
  }

  async function handleCopy() {
    const url = getUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Some browsers block clipboard without secure context; do nothing graceful
    }
  }

  function handleX() {
    const url = getUrl();
    const text = `${title} — ${tagline}`;
    const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(intent, '_blank', 'noopener,noreferrer');
  }

  async function handleNativeShare() {
    const url = getUrl();
    const shareData = { title, text: tagline, url };
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // User cancelled or share unsupported — fall back to copy
      }
    }
    await handleCopy();
  }

  function handleOpenNewTab() {
    const url = getUrl();
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="share-row">
      <button type="button" className="share-btn" onClick={handleCopy} aria-live="polite">
        {copied ? '✓ ' + t('Copy') : t('CopyLink')}
      </button>
      <div className="share-icons">
        <button
          type="button"
          className="btn btn-icon"
          onClick={handleX}
          aria-label="Share on X"
          title="Share on X"
        >
          𝕏
        </button>
        <button
          type="button"
          className="btn btn-icon"
          onClick={handleNativeShare}
          aria-label={t('Share')}
          title={t('Share')}
        >
          ↗
        </button>
        <button
          type="button"
          className="btn btn-icon"
          onClick={handleOpenNewTab}
          aria-label={t('OpenApp')}
          title={t('OpenApp')}
        >
          ⌬
        </button>
      </div>
    </div>
  );
}
