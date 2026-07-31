import { getCurrentAgent } from '@/app/partners/_lib/auth';
import { Eyebrow } from '@/components/brand';
import { database } from '@repo/database';
import Link from 'next/link';
import { CopyButton } from './copy-button';

export const dynamic = 'force-dynamic';

function formatGBP(pence: number | null | undefined) {
  if (pence == null) return '–';
  return `£${Math.round(pence / 100).toLocaleString('en-GB')}`;
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'border border-hair bg-soft text-body',
  processing: 'border border-hair bg-white text-body',
  quoted: 'border border-leaf/30 bg-leaf/10 text-leaf',
  accepted: 'border border-leaf/30 bg-leaf/10 text-leaf',
  declined: 'border border-hair bg-white text-wax',
  expired: 'border border-hair bg-soft text-body/70',
  converted_to_deal: 'border border-leaf/30 bg-leaf/10 text-leaf',
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

  const referralLink = `${process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3001'}/partners/${agent.referralCode}`;

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      {/* Greeting */}
      <section>
        <Eyebrow>Welcome back</Eyebrow>
        <h1 className="mt-1 font-semibold font-serif text-4xl">
          Hi {agent.contactName.split(' ')[0]}.
        </h1>
      </section>

      {/* Referral link */}
      <section className="mt-10 rounded-lg border border-hair bg-soft p-8">
        <Eyebrow>Your referral link</Eyebrow>
        <p className="mt-2 font-serif text-xl">
          Share this with a seller. We credit every offer back to you.
        </p>
        <div className="mt-4 flex flex-col items-stretch gap-2 sm:flex-row">
          <input
            readOnly
            value={referralLink}
            className="flex-1 rounded-[2px] border border-hair bg-white px-4 py-3 text-sm [font-family:var(--font-courier)]"
          />
          <CopyButton text={referralLink} />
        </div>
        <div className="mt-4 flex items-center gap-3 text-body text-sm">
          <Eyebrow tone="muted">Referral code</Eyebrow>
          <span className="font-semibold text-forest [font-family:var(--font-courier)]">
            {agent.referralCode}
          </span>
        </div>
      </section>

      {/* Metrics — a ledger strip: hairline rules, one dominant figure */}
      <section className="mt-10 border-hair border-y">
        <div className="grid divide-y divide-hair sm:grid-cols-[1.7fr_1fr_1fr_1fr] sm:divide-x sm:divide-y-0">
          <div className="py-6 sm:pr-8">
            <Eyebrow tone="muted">Total referrals</Eyebrow>
            <p className="mt-3 font-serif text-6xl leading-none">
              {metrics.total}
            </p>
          </div>
          {[
            { label: 'Live quotes', value: metrics.quoted },
            { label: 'Accepted', value: metrics.accepted },
            { label: 'Completed', value: metrics.completed },
          ].map((m) => (
            <div key={m.label} className="py-6 sm:px-6">
              <Eyebrow tone="muted">{m.label}</Eyebrow>
              <p className="mt-3 font-serif text-3xl leading-none">{m.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Recent quotes */}
      <section className="mt-10">
        <h2 className="font-semibold font-serif text-2xl">Recent referrals</h2>
        {quotes.length === 0 ? (
          <div className="mt-6 rounded-md border border-hair border-dashed bg-white p-10 text-center">
            <p className="font-serif text-lg">No referrals yet.</p>
            <p className="mt-2 text-body text-sm">
              Share your referral link with a seller. Anything they submit using
              it will show up here.
            </p>
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-md border border-hair bg-white">
            <table className="min-w-full divide-y divide-hair text-sm">
              <thead className="bg-soft text-body text-xs uppercase [font-family:var(--font-courier)]">
                <tr>
                  <th className="px-5 py-3 text-left">Property</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-right">AVM mid</th>
                  <th className="px-5 py-3 text-right">Our offer</th>
                  <th className="px-5 py-3 text-right">Your est. earnings</th>
                  <th className="px-5 py-3 text-left">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hair">
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
                    <tr key={q.id} className="hover:bg-soft/50">
                      <td className="px-5 py-3">
                        <p className="font-medium">{q.address}</p>
                        <p className="text-body/70 text-xs">{q.postcode}</p>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 font-medium text-xs ${STATUS_STYLES[q.status] || 'border border-hair bg-soft text-body'}`}
                        >
                          {q.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right text-body">
                        {formatGBP(avmMid)}
                      </td>
                      <td className="px-5 py-3 text-right font-medium">
                        {formatGBP(q.offer?.offerPence)}
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-leaf">
                        {formatGBP(estEarnings)}
                      </td>
                      <td className="px-5 py-3 text-body/70 text-xs">
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
        <section className="mt-10 rounded-lg bg-forest p-8 text-white">
          <Eyebrow tone="light">Unlock Preferred</Eyebrow>
          <p className="mt-2 font-semibold font-serif text-2xl">
            Complete 3 referrals to move up.
          </p>
          <p className="mt-3 text-sm text-white/70">
            Preferred tier unlocks priority offer handling, a co-branded landing
            page, and featured placement on our partner wall.
          </p>
        </section>
      )}

      {/* Resources */}
      <section className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Link
          href="/instant-offer/partner-brief"
          className="rounded-md border border-hair bg-white p-6 transition hover:border-leaf"
        >
          <p className="font-semibold font-serif text-lg">
            Agent Partner Brief →
          </p>
          <p className="mt-2 text-body text-sm">
            Printable one-pager to show clients and colleagues.
          </p>
        </Link>
        <Link
          href="/instant-offer/seller-disclosure"
          className="rounded-md border border-hair bg-white p-6 transition hover:border-leaf"
        >
          <p className="font-semibold font-serif text-lg">
            Seller Disclosure Form →
          </p>
          <p className="mt-2 text-body text-sm">
            DMCC 2024 + NTS-compliant. Print and have your seller sign.
          </p>
        </Link>
      </section>
    </main>
  );
}
