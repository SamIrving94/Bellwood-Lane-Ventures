'use client';

import { useState } from 'react';

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* ignore */
        }
      }}
      className="rounded-xl bg-leaf px-6 py-3 font-medium text-sm text-white transition hover:bg-leaf-dark"
    >
      {copied ? 'Copied' : 'Copy link'}
    </button>
  );
}
