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
  draft: 'bg-stone-100 text-stone-600',
  processing: 'bg-[#FBF7F3] text-[#874646]',
  quoted: 'bg-[#F6ECE7] text-[#874646]',
  accepted: 'bg-[#F6ECE7] text-[#C0492F]',
  declined: 'bg-stone-100 text-stone-500',
  expired: 'bg-stone-100 text-stone-500',
  converted_to_deal: 'bg-[#874646] text-white',
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
        <Eyebrow>welcome back</Eyebrow>
        <h1 className="mt-1 font-semibold font-serif text-4xl">
          Hi {agent.contactName.split(' ')[0]}.
        </h1>
      </section>

      {/* Referral link */}
      <section className="mt-10 rounded-[2px] border border-[#DB5C5C]/40 bg-[#F6ECE7] p-8">
        <Eyebrow>your referral link</Eyebrow>
        <p className="mt-2 font-serif text-xl">
          Share this with a seller. We credit every offer back to you.
        </p>
        <div className="mt-4 flex flex-col items-stretch gap-2 sm:flex-row">
          <input
            readOnly
            value={referralLink}
            className="flex-1 rounded-md border border-stone-300 bg-white px-4 py-3 font-mono text-sm"
          />
          <CopyButton text={referralLink} />
        </div>
        <div className="mt-4 flex items-center gap-3 text-sm text-stone-600">
          <Eyebrow tone="muted">referral code</Eyebrow>
          <span className="font-mono font-semibold text-[#874646]">
            {agent.referralCode}
          </span>
        </div>
      </section>

      {/* Metrics */}
      <section className="mt-10 border-[#EAE0D9] border-y py-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:gap-0 sm:divide-x sm:divide-[#EAE0D9]">
          <div className="sm:pr-10">
            <Eyebrow tone="muted">total referrals</Eyebrow>
            <p className="mt-2 font-semibold font-serif text-6xl leading-none">
              {metrics.total}
            </p>
          </div>
          {[
            { label: 'Live quotes', value: metrics.quoted },
            { label: 'Accepted', value: metrics.accepted },
            { label: 'Completed', value: metrics.completed },
          ].map((m) => (
            <div key={m.label} className="sm:px-10">
              <p className="text-sm text-stone-500">{m.label}</p>
              <p className="mt-2 font-semibold font-serif text-3xl leading-none">
                {m.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Recent quotes */}
      <section className="mt-10">
        <h2 className="font-semibold font-serif text-2xl">Recent referrals</h2>
        {quotes.length === 0 ? (
          <div className="mt-6 rounded-md border border-stone-300 border-dashed bg-white p-10 text-center">
            <p className="font-serif text-lg">No referrals yet.</p>
            <p className="mt-2 text-sm text-stone-600">
              Share your referral link with a seller. Anything they submit using
              it will show up here.
            </p>
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-md border border-stone-200 bg-white">
            <table className="min-w-full divide-y divide-stone-200 text-sm">
              <thead className="bg-[#FBF7F3] font-serif text-[13px] text-stone-500 italic">
                <tr>
                  <th className="px-5 py-3 text-left">Property</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-right">AVM mid</th>
                  <th className="px-5 py-3 text-right">Our offer</th>
                  <th className="px-5 py-3 text-right">Your est. earnings</th>
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
                      <td className="px-5 py-3 text-right font-medium text-[#DB5C5C]">
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
        <section className="mt-10 rounded-md bg-[#874646] p-8 text-white">
          <Eyebrow tone="light">unlock preferred</Eyebrow>
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
          className="rounded-md border border-stone-200 bg-white p-6 transition hover:border-[#DB5C5C]"
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
          className="rounded-md border border-stone-200 bg-white p-6 transition hover:border-[#DB5C5C]"
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
