'use client';

import { useState } from 'react';

interface CopyBlockProps {
  text: string;
  copyLabel: string;
  copiedLabel: string;
}

export function CopyBlock({ text, copyLabel, copiedLabel }: CopyBlockProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="dev-code">
      <pre>
        <code>{text}</code>
      </pre>
      <button type="button" className="dev-copy-btn" data-copied={copied} onClick={handleCopy}>
        {copied ? copiedLabel : copyLabel}
      </button>
    </div>
  );
}
