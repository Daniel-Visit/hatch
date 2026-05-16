'use client';

import { useState } from 'react';

interface Props {
  endpoint: string;
}

export function McpConfigSnippet({ endpoint }: Props) {
  const [copied, setCopied] = useState(false);

  const config = JSON.stringify(
    {
      mcpServers: {
        hatch: {
          url: endpoint,
          headers: { Authorization: 'Bearer <paste-your-token>' },
        },
      },
    },
    null,
    2,
  );

  function handleCopy() {
    void navigator.clipboard.writeText(config);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-md bg-neutral-900 p-4 text-xs text-neutral-100">
        <code>{config}</code>
      </pre>
      <button
        type="button"
        onClick={handleCopy}
        className="absolute right-2 top-2 rounded-md bg-neutral-700 px-2 py-1 text-xs font-medium text-white hover:bg-neutral-600"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
}
