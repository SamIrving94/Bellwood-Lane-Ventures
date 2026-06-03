'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { approveAndSendOffer } from './actions';

type Props = {
  quoteId: string;
  founderActionId: string;
  signedOfferUrl: string;
};

/**
 * Final founder click on the 4-hour SLA flow. Fires the signed-offer
 * email, writes an `offer_sent` DealUpdate, marks the FounderAction done.
 */
export function ApproveAndSendButton({
  quoteId,
  founderActionId,
  signedOfferUrl,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'sent' | 'skipped'>('idle');

  const onClick = () =>
    startTransition(async () => {
      setError(null);
      try {
        const result = await approveAndSendOffer(quoteId, founderActionId);
        setStatus(result.sent ? 'sent' : 'skipped');
        router.refresh();
      } catch (err) {
        setError((err as Error).message ?? 'Send failed');
      }
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={isPending || status === 'sent'}
          onClick={onClick}
          className="rounded-full bg-amber-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-amber-700 disabled:opacity-50"
        >
          {isPending
            ? 'Sending…'
            : status === 'sent'
              ? 'Sent'
              : 'Approve & Send'}
        </button>
        <a
          href={signedOfferUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-700 underline underline-offset-4 hover:text-blue-900"
        >
          Preview signed PDF
        </a>
      </div>

      {status === 'skipped' && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          Email skipped — Resend not configured locally. Timeline still
          updated.
        </p>
      )}

      {error && (
        <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}
