import { getCurrentAgent } from '@/app/partners/_lib/auth';
import { brand } from '@repo/brand';
import { database } from '@repo/database';
import Link from 'next/link';
import { CopyButton } from './copy-button';

export const dynamic = 'force-dynamic';

function formatGBP(pence: number | null | undefined) {
  if (pence == null) return '—';
  return `£${Math.round(pence / 100).toLocaleString('en-GB')}`;
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-stone-100 text-stone-600',
  processing: 'bg-amber-100 text-amber-700',
  quoted: 'bg-blue-100 text-blue-700',
  accepted: 'bg-emerald-100 text-emerald-700',
  declined: 'bg-rose-100 text-rose-700',
  expired: 'bg-stone-100 text-stone-500',
  converted_to_deal: 'bg-soft text-leaf',
};

export default async function PortalPage() {
  const agent = await getCurrentAgent();
  if (!agent) return null;

  const quotes = await database.quoteRequest.findMany({
    where: { referralCode: agent.referralCode },
    include: { offer: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const metrics = {
    total: quotes.length,
    quoted: quotes.filter((q) => q.status === 'quoted').length,
    accepted: quotes.filter((q) => q.status === 'accepted').length,
    completed: quotes.filter((q) => q.status === 'converted_to_deal').length,
  };

  // Fall back to the brand's canonical URL, never localhost — an unset env
  // var must not hand agents an unshareable link.
  const referralLink = `${process.env.NEXT_PUBLIC_WEB_URL || brand.url}/partners/${agent.referralCode}`;

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      {/* Greeting */}
      <section>
        <p className="text-leaf text-xs uppercase tracking-widest">
          Welcome back
        </p>
        <h1 className="mt-1 font-semibold font-serif text-4xl">
          Hi {agent.contactName.split(' ')[0]} —
        </h1>
      </section>

      {/* Referral link */}
      <section className="mt-10 rounded-3xl border-2 border-leaf/40 bg-soft p-8">
        <p className="text-leaf text-xs uppercase tracking-widest">
          Your referral link
        </p>
        <p className="mt-2 font-serif text-xl">
          Share this with a seller — we credit every offer back to you.
        </p>
        <div className="mt-4 flex flex-col items-stretch gap-2 sm:flex-row">
          <input
            readOnly
            value={referralLink}
            className="flex-1 rounded-xl border border-stone-300 bg-white px-4 py-3 font-mono text-sm"
          />
          <CopyButton text={referralLink} />
        </div>
        <div className="mt-4 flex items-center gap-2 text-sm text-stone-600">
          <span className="text-stone-500 text-xs uppercase tracking-widest">
            Referral code:
          </span>
          <span className="font-mono font-semibold text-forest">
            {agent.referralCode}
          </span>
        </div>
      </section>

      {/* Metrics */}
      <section className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: 'Total referrals', value: metrics.total },
          { label: 'Live quotes', value: metrics.quoted },
          { label: 'Accepted', value: metrics.accepted },
          { label: 'Completed', value: metrics.completed },
        ].map((m) => (
          <div
            key={m.label}
            className="rounded-2xl border border-stone-200 bg-white p-6"
          >
            <p className="text-stone-500 text-xs uppercase tracking-widest">
              {m.label}
            </p>
            <p className="mt-2 font-semibold font-serif text-4xl">{m.value}</p>
          </div>
        ))}
      </section>

      {/* Recent quotes */}
      <section className="mt-10">
        <h2 className="font-semibold font-serif text-2xl">Recent referrals</h2>
        {quotes.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-stone-300 border-dashed bg-white p-10 text-center">
            <p className="font-serif text-lg">No referrals yet.</p>
            <p className="mt-2 text-sm text-stone-600">
              Share your referral link with a seller — anything they submit
              using it will show up here.
            </p>
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-2xl border border-stone-200 bg-white">
            <table className="min-w-full divide-y divide-stone-200 text-sm">
              <thead className="bg-stone-50 text-stone-500 text-xs uppercase tracking-widest">
                <tr>
                  <th className="px-5 py-3 text-left">Property</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-right">AVM mid</th>
                  <th className="px-5 py-3 text-right">Our offer</th>
                  <th className="px-5 py-3 text-right">
                    Est. earnings
                    <span className="block font-normal normal-case tracking-normal">
                      illustrative at 1% — your written terms apply
                    </span>
                  </th>
                  <th className="px-5 py-3 text-left">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {quotes.map((q) => {
                  const avmMid = q.offer
                    ? Math.round(
                        (q.offer.estimatedMarketValueMinPence +
                          q.offer.estimatedMarketValueMaxPence) /
                          2
                      )
                    : null;
                  const estEarnings = q.offer
                    ? Math.round(q.offer.offerPence * 0.01)
                    : null; // estimated sale commission at 1%, resale instruction not counted yet
                  return (
                    <tr key={q.id} className="hover:bg-stone-50">
                      <td className="px-5 py-3">
                        <p className="font-medium">{q.address}</p>
                        <p className="text-stone-500 text-xs">{q.postcode}</p>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 font-medium text-xs ${STATUS_STYLES[q.status] || 'bg-stone-100 text-stone-600'}`}
                        >
                          {q.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right text-stone-600">
                        {formatGBP(avmMid)}
                      </td>
                      <td className="px-5 py-3 text-right font-medium">
                        {formatGBP(q.offer?.offerPence)}
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-leaf">
                        {formatGBP(estEarnings)}
                      </td>
                      <td className="px-5 py-3 text-stone-500 text-xs">
                        {q.createdAt.toLocaleDateString('en-GB')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Tier upsell */}
      {agent.tier === 'partner' && (
        <section className="mt-10 rounded-3xl bg-forest p-8 text-white">
          <p className="text-leaf text-xs uppercase tracking-widest">
            Unlock Preferred
          </p>
          <p className="mt-2 font-semibold font-serif text-2xl">
            Complete 3 referrals to move up.
          </p>
          <p className="mt-3 text-sm text-white/70">
            Preferred tier unlocks priority offer handling, a co-branded landing
            page, and featured placement on our partner wall.
          </p>
        </section>
      )}

      {/* Tools — the two things an agent actually uses day-to-day */}
      <section className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Link
          href="/save-the-sale"
          className="rounded-2xl border-2 border-leaf/40 bg-white p-6 transition hover:border-leaf"
        >
          <p className="font-semibold font-serif text-lg">Save a sale →</p>
          <p className="mt-2 text-sm text-stone-600">
            Sale collapsed? Send the address — an indicative figure on screen,
            credited to your referral code.
          </p>
        </Link>
        <Link
          href="/agents/score"
          className="rounded-2xl border-2 border-leaf/40 bg-white p-6 transition hover:border-leaf"
        >
          <p className="font-semibold font-serif text-lg">Kept Score →</p>
          <p className="mt-2 text-sm text-stone-600">
            An indicative range to show a seller before you leave their living
            room.
          </p>
        </Link>
      </section>

      {/* Resources */}
      <section className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Link
          href="/instant-offer/partner-brief"
          className="rounded-2xl border border-stone-200 bg-white p-6 transition hover:border-leaf"
        >
          <p className="font-semibold font-serif text-lg">
            Agent Partner Brief →
          </p>
          <p className="mt-2 text-sm text-stone-600">
            Printable one-pager to show clients and colleagues.
          </p>
        </Link>
        <Link
          href="/instant-offer/seller-disclosure"
          className="rounded-2xl border border-stone-200 bg-white p-6 transition hover:border-leaf"
        >
          <p className="font-semibold font-serif text-lg">
            Seller Disclosure Form →
          </p>
          <p className="mt-2 text-sm text-stone-600">
            DMCC 2024 + NTS-compliant. Print and have your seller sign.
          </p>
        </Link>
      </section>
    </main>
  );
}
