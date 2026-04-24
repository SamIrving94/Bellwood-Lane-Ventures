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
      className="rounded-xl bg-[#0A2540] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#13365c]"
    >
      {copied ? 'Copied' : 'Copy link'}
    </button>
  );
}
