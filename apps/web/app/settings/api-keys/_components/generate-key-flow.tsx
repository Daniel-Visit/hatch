'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { generateApiKey } from '@/lib/actions/api-keys';

export function GenerateKeyFlow() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      const result = await generateApiKey({ label: 'Claude Desktop' });
      if (result.ok) {
        setToken(result.data.plainToken);
      } else {
        setError(result.error);
      }
    });
  }

  function handleCopy() {
    if (!token) return;
    void navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleClose() {
    setToken(null);
    router.refresh();
  }

  if (token) {
    return (
      <div className="space-y-3 rounded-md border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
        <div>
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
            Save this now — you won&apos;t see it again.
          </p>
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
            After closing, the token is gone for good. Revoke and regenerate if you lose it.
          </p>
        </div>
        <code className="block break-all rounded bg-white p-3 font-mono text-xs dark:bg-neutral-900">
          {token}
        </code>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
          >
            {copied ? 'Copied!' : 'Copy token'}
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium dark:border-neutral-700"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleGenerate}
        disabled={pending}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        {pending ? 'Generating…' : 'Generate API Key'}
      </button>
      {error && <p className="text-sm text-red-600 dark:text-red-400">Error: {error}</p>}
    </div>
  );
}
