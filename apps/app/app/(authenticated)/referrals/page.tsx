import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Header } from '../components/header';

export const metadata: Metadata = {
  title: 'Referral feed — Bellwood Ventures',
  description: 'Leads Bellwood has passed on, listed for referral partners.',
};

export const dynamic = 'force-dynamic';

function formatGBP(pence: number | null): string {
  if (pence === null) return '—';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(pence / 100);
}

const verdictColors: Record<string, string> = {
  STRONG: 'bg-emerald-100 text-emerald-800',
  VIABLE: 'bg-blue-100 text-blue-800',
  THIN: 'bg-amber-100 text-amber-800',
  PASS: 'bg-red-100 text-red-800',
  INSUFFICIENT_DATA: 'bg-gray-100 text-gray-700',
};

const ReferralFeedPage = async () => {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  // Only released leads appear here. Vendor contact details (name/phone/email)
  // are never selected — partners get the lead's shape, not its PII, until a
  // referral is agreed off-platform.
  const leads = await database.scoutLead.findMany({
    where: { referralReleased: true },
    orderBy: { referralReleasedAt: 'desc' },
    select: {
      id: true,
      postcode: true,
      leadType: true,
      leadScore: true,
      verdict: true,
      estimatedEquityPence: true,
      referralReason: true,
      referralPricePence: true,
      referralReleasedAt: true,
      referralClaimedBy: true,
      referralClaimedAt: true,
    },
  });

  const claimed = leads.filter((l) => l.referralClaimedBy).length;

  return (
    <>
      <Header
        pages={[{ title: 'Leads', url: '/leads' }]}
        page="Referral feed"
      />
      <main className="mx-auto w-full max-w-5xl space-y-6 p-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Leads · Referral feed
          </p>
          <h1 className="mt-1 font-semibold text-2xl tracking-tight">
            Referral feed
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground text-sm">
            Leads Bellwood has passed on for its own book and listed for
            referral partners. {leads.length} listed · {claimed} claimed.
            Vendor contact details are never shown here — list a lead from its
            page with{' '}
            <span className="font-medium text-foreground">Pass &amp; list</span>.
          </p>
        </div>

        {leads.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-slate-50 p-8 text-center text-sm text-muted-foreground">
            Nothing on the feed yet. Open a lead you&apos;ve decided to pass on
            and use <span className="font-medium">Pass &amp; list</span> to add
            it here.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {leads.map((l) => (
              <Link
                key={l.id}
                href={`/leads/${l.id}`}
                className="rounded-xl border bg-card p-5 transition hover:border-foreground/30 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{l.postcode}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {l.leadType.replace(/[-_]/g, ' ')}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${verdictColors[l.verdict] || 'bg-muted'}`}
                    >
                      {l.verdict}
                    </span>
                    {l.referralClaimedBy && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        Claimed
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Score
                    </p>
                    <p className="font-mono text-sm font-semibold tabular-nums">
                      {l.leadScore}/100
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Est. equity
                    </p>
                    <p className="font-mono text-sm font-semibold tabular-nums">
                      {formatGBP(l.estimatedEquityPence)}
                    </p>
                  </div>
                </div>

                {l.referralPricePence ? (
                  <p className="mt-3 text-xs">
                    <span className="text-muted-foreground">Referral fee: </span>
                    <span className="font-mono font-semibold">
                      {formatGBP(l.referralPricePence)}
                    </span>
                  </p>
                ) : null}

                {l.referralReason && (
                  <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">
                    {l.referralReason}
                  </p>
                )}

                {l.referralClaimedBy && (
                  <p className="mt-2 text-[11px] text-emerald-700 dark:text-emerald-400">
                    Claimed by {l.referralClaimedBy}
                  </p>
                )}

                <p className="mt-3 text-[10px] text-muted-foreground">
                  Listed{' '}
                  {l.referralReleasedAt
                    ? new Date(l.referralReleasedAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—'}
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
};

export default ReferralFeedPage;
