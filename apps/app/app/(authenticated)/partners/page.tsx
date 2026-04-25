import Link from 'next/link';
import type { Metadata } from 'next';
import { database } from '@repo/database';
import { Header } from '../components/header';

export const metadata: Metadata = {
  title: 'Partners — Bellwoods Lane',
};

export const dynamic = 'force-dynamic';

const TIER_TONE: Record<string, string> = {
  partner: 'bg-slate-100 text-slate-700',
  preferred: 'bg-amber-100 text-amber-700',
  elite: 'bg-amber-50 ring-1 ring-amber-300 text-amber-800',
};

export default async function PartnersPage() {
  const [agents, totalReferrals, totalDeals] = await Promise.all([
    database.agentAccount.findMany({
      orderBy: [{ totalReferrals: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    }),
    database.agentAccount.aggregate({ _sum: { totalReferrals: true } }),
    database.agentAccount.aggregate({ _sum: { totalDeals: true } }),
  ]);

  return (
    <>
      <Header
        pages={[{ title: 'Partners', url: '/partners' }]}
        page="All partners"
      />
      <main className="mx-auto w-full max-w-7xl space-y-6 p-6">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">Partners</h1>
          <p className="text-muted-foreground text-sm">
            Estate agents who have used the Instant Offer tool — auto-created
            accounts, claimed dashboards, and explicitly registered partners.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: 'Partners', value: agents.length },
            {
              label: 'Total referrals',
              value: totalReferrals._sum.totalReferrals ?? 0,
            },
            {
              label: 'Total deals',
              value: totalDeals._sum.totalDeals ?? 0,
            },
            {
              label: 'Elite',
              value: agents.filter((a) => a.tier === 'elite').length,
            },
          ].map((m) => (
            <div
              key={m.label}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <p className="text-muted-foreground text-xs uppercase tracking-widest">
                {m.label}
              </p>
              <p className="mt-2 font-serif text-4xl font-semibold">
                {m.value}
              </p>
            </div>
          ))}
        </div>

        {agents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <p className="font-serif text-xl">No partners yet.</p>
            <p className="mt-2 text-muted-foreground text-sm">
              Agents are auto-created when they use the Instant Offer tool
              with role=agent.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-muted-foreground text-xs uppercase tracking-widest">
                <tr>
                  <th className="px-5 py-3 text-left">Firm</th>
                  <th className="px-5 py-3 text-left">Contact</th>
                  <th className="px-5 py-3 text-left">Code</th>
                  <th className="px-5 py-3 text-left">Tier</th>
                  <th className="px-5 py-3 text-right">Referrals</th>
                  <th className="px-5 py-3 text-right">Deals</th>
                  <th className="px-5 py-3 text-left">Last login</th>
                  <th className="px-5 py-3 text-left">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {agents.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <p className="font-medium">{a.firmName}</p>
                      {a.postcode && (
                        <p className="text-muted-foreground text-xs">
                          {a.postcode}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <p>{a.contactName}</p>
                      <p className="text-muted-foreground text-xs">
                        <a
                          href={`mailto:${a.email}`}
                          className="hover:text-blue-700 hover:underline"
                        >
                          {a.email}
                        </a>
                      </p>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs">
                      {a.referralCode}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${TIER_TONE[a.tier] ?? TIER_TONE.partner}`}
                      >
                        {a.tier}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-medium">
                      {a.totalReferrals}
                    </td>
                    <td className="px-5 py-3 text-right">{a.totalDeals}</td>
                    <td className="px-5 py-3 text-muted-foreground text-xs">
                      {a.lastLoginAt
                        ? a.lastLoginAt.toLocaleDateString('en-GB')
                        : '—'}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground text-xs">
                      {a.createdAt.toLocaleDateString('en-GB')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-muted-foreground">
          <strong className="text-slate-700">How tiers work:</strong> Partner
          (first referral completed), Preferred (3+ completions), Elite (10+
          or 3 in 90 days). Tier upgrades are not yet automated — adjust the
          field manually for now.
        </div>
      </main>
    </>
  );
}
