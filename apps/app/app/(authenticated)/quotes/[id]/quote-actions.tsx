'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  acceptQuote,
  declineQuote,
  postNote,
} from '@/app/actions/quotes/update';

type Props = {
  quoteRequestId: string;
  hasOffer: boolean;
  status: string;
};

export function QuoteActions({ quoteRequestId, hasOffer, status }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<void>) =>
    startTransition(async () => {
      setError(null);
      try {
        await fn();
        router.refresh();
      } catch (err) {
        setError((err as Error).message ?? 'Action failed');
      }
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isPending || !hasOffer || status === 'accepted'}
          onClick={() => run(() => acceptQuote(quoteRequestId))}
          className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          Mark accepted
        </button>
        <button
          type="button"
          disabled={isPending || status === 'declined'}
          onClick={() => run(() => declineQuote(quoteRequestId))}
          className="rounded-full border border-rose-200 bg-rose-50 px-5 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
        >
          Decline
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => setNoteOpen((v) => !v)}
          className="rounded-full border border-slate-300 px-5 py-2 text-sm transition hover:border-slate-400 disabled:opacity-50"
        >
          {noteOpen ? 'Cancel note' : 'Add note + email chain'}
        </button>
      </div>

      {noteOpen && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="What should the seller, agent, and team know?"
            className="w-full resize-none rounded-lg border border-slate-300 bg-white p-3 text-sm focus:border-amber-500 focus:outline-none"
            rows={3}
          />
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Goes to seller email, linked agent (if any), and Anthony.
            </p>
            <button
              type="button"
              disabled={isPending || noteText.trim().length === 0}
              onClick={() =>
                run(async () => {
                  await postNote(quoteRequestId, noteText.trim());
                  setNoteText('');
                  setNoteOpen(false);
                })
              }
              className="rounded-full bg-amber-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-amber-600 disabled:opacity-50"
            >
              {isPending ? 'Sending...' : 'Send to chain'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}
