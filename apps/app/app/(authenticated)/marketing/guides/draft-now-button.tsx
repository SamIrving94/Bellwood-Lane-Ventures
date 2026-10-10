'use client';

import {
  type DraftGuideNowResult,
  draftGuideNow,
} from '@/app/actions/guides/draft-now';
import { Button } from '@repo/design-system/components/ui/button';
import Link from 'next/link';
import { useState, useTransition } from 'react';

/**
 * Runs the weekly guide draft on demand and says plainly what happened.
 * The result line is the diagnosis: drafted, drafted-but-not-saved (the
 * GuidePost table is missing), or why no draft was written.
 */
export function DraftNowButton() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<DraftGuideNowResult | null>(null);

  const run = () =>
    startTransition(async () => {
      setResult(null);
      setResult(await draftGuideNow());
    });

  return (
    <div className="space-y-2">
      <Button size="sm" disabled={isPending} onClick={run}>
        {isPending ? 'Drafting… (1–3 minutes)' : 'Draft a guide now'}
      </Button>
      {result && <ResultLine result={result} />}
    </div>
  );
}

function ResultLine({ result }: { result: DraftGuideNowResult }) {
  if (!result.ok) {
    return <p className="text-red-600 text-sm">❌ {result.error}</p>;
  }
  if (result.started) {
    return (
      <p className="text-sm">
        ⏳ <strong>Still drafting.</strong> It will appear in the{' '}
        <Link href="/marketing/queue" className="underline">
          Queue
        </Link>{' '}
        in a few minutes. Refresh this page then.
      </p>
    );
  }

  const extras = [
    `${result.signals} news items read`,
    result.pickFallback ? 'no topical hook this week' : null,
    result.failedSources.length > 0
      ? `sources that failed: ${result.failedSources.join(', ')}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  if (result.drafted && result.guidePostId) {
    return (
      <div className="text-sm">
        <p>
          ✅ <strong>Draft ready</strong>
          {result.questionKey ? ` (${result.questionKey})` : ''}. It is in the
          list below. Read it in the{' '}
          <Link href="/marketing/queue" className="underline">
            Queue
          </Link>
          , then press <strong>Publish</strong>.
        </p>
        <p className="text-muted-foreground text-xs">{extras}</p>
      </div>
    );
  }

  if (result.drafted) {
    // The drafter wrote it and filed the review card, but the GuidePost
    // insert failed: in practice the table was never pushed to prod.
    return (
      <div className="text-amber-700 text-sm dark:text-amber-400">
        <p>
          ⚠️ <strong>Draft written, but not saved as a guide.</strong> The card
          is in the Queue, but it has no Publish button.
        </p>
        <p>
          Likely cause: the <code>GuidePost</code> database table is missing.
          Run <code>pnpm migrate</code> against the live database, then try
          again.
        </p>
      </div>
    );
  }

  return (
    <div className="text-red-600 text-sm">
      <p>
        ❌ <strong>No draft.</strong> {result.draftError ?? 'Unknown reason.'}
      </p>
      <p className="text-muted-foreground text-xs">{extras}</p>
    </div>
  );
}
