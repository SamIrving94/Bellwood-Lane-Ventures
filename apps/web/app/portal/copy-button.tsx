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
      className="rounded-xl bg-[#874646] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#6F3A3A]"
    >
      {copied ? 'Copied' : 'Copy link'}
    </button>
  );
}
