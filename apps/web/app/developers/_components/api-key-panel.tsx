'use client';

// Step 1 of the MCP connect guide on /developers — manages the user's
// personal API key inline. Auth-aware: prompts sign-in when logged out,
// generates / reveals / revokes the key when logged in.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { generateApiKey, revokeApiKey } from '@/lib/actions/api-keys';

export interface ActiveKey {
  id: string;
  tokenPrefix: string;
  meta: string;
}

interface ApiKeyPanelProps {
  signedIn: boolean;
  activeKey: ActiveKey | null;
  defaultKeyLabel: string;
  labels: {
    signInPrompt: string;
    signInCta: string;
    noKeyHint: string;
    generate: string;
    generating: string;
    revoke: string;
    revoking: string;
    saveNotice: string;
    lossWarning: string;
    copy: string;
    copied: string;
    done: string;
    error: string;
  };
}

export function ApiKeyPanel({ signedIn, activeKey, defaultKeyLabel, labels }: ApiKeyPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      const result = await generateApiKey({ label: defaultKeyLabel });
      if (result.ok) setToken(result.data.plainToken);
      else setError(result.error);
    });
  }

  function handleRevoke() {
    if (!activeKey) return;
    setError(null);
    startTransition(async () => {
      const result = await revokeApiKey({ id: activeKey.id });
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  function handleCopy() {
    if (!token) return;
    void navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDone() {
    setToken(null);
    router.refresh();
  }

  // Token just generated — show it once.
  if (token) {
    return (
      <div className="card dev-key-panel dev-key-reveal">
        <p className="dev-key-notice">{labels.saveNotice}</p>
        <code className="dev-key-token">{token}</code>
        <p className="dev-key-warn">{labels.lossWarning}</p>
        <div className="dev-key-actions">
          <button type="button" className="btn btn--primary" onClick={handleCopy}>
            {copied ? labels.copied : labels.copy}
          </button>
          <button type="button" className="btn" onClick={handleDone}>
            {labels.done}
          </button>
        </div>
      </div>
    );
  }

  // Logged out.
  if (!signedIn) {
    return (
      <div className="card dev-key-panel">
        <p className="dev-key-hint">{labels.signInPrompt}</p>
        <a href="/sign-in?next=/developers" className="btn btn--primary">
          {labels.signInCta}
        </a>
      </div>
    );
  }

  // Logged in, has an active key.
  if (activeKey) {
    return (
      <div className="card dev-key-panel">
        <div className="dev-key-row">
          <code className="dev-key-prefix">{activeKey.tokenPrefix}…****</code>
          <button
            type="button"
            className="btn dev-key-revoke"
            onClick={handleRevoke}
            disabled={pending}
          >
            {pending ? labels.revoking : labels.revoke}
          </button>
        </div>
        <p className="dev-key-meta">{activeKey.meta}</p>
        {error && <p className="dev-key-error">{`${labels.error}: ${error}`}</p>}
      </div>
    );
  }

  // Logged in, no key yet.
  return (
    <div className="card dev-key-panel">
      <p className="dev-key-hint">{labels.noKeyHint}</p>
      <button
        type="button"
        className="btn btn--primary"
        onClick={handleGenerate}
        disabled={pending}
      >
        {pending ? labels.generating : labels.generate}
      </button>
      {error && <p className="dev-key-error">{`${labels.error}: ${error}`}</p>}
    </div>
  );
}
