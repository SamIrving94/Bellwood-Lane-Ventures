'use client';

import { useState } from 'react';

type Props = {
  bookingLink: string;
};

export const CalendlyButton = ({ bookingLink }: Props) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bookingLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: open in new tab so the founder can copy manually
      window.open(bookingLink, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
        >
          {copied ? 'Copied!' : 'Send Calendly Link'}
        </button>
        <a
          href={bookingLink}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:underline"
        >
          Open link
        </a>
      </div>
      <p className="break-all text-xs text-muted-foreground">{bookingLink}</p>
    </div>
  );
};
