import type { Metadata } from 'next';
import { auth } from '@repo/auth/server';
import { getAccountCredits } from '@repo/property-data';
import { redirect } from 'next/navigation';
import { Header } from '../components/header';
import { ConciergeChat } from './concierge-chat';

export const metadata: Metadata = {
  title: 'Research — Bellwoods Lane',
  description:
    'Ask George — PropertyData’s AI assistant — anything about the UK property market.',
};

export const dynamic = 'force-dynamic';

const SUGGESTED_PROMPTS: Array<{ label: string; prompt: string }> = [
  {
    label: 'Comparable evidence',
    prompt:
      'Pull recent comparable sold prices and £/sqft trends in postcode SK4 3HQ for terraced houses. Summarise in three bullet points.',
  },
  {
    label: 'Active agents in a postcode',
    prompt:
      'List the five estate agents with the most active listings in postcode M14 in the last 30 days, with phone numbers if available.',
  },
  {
    label: 'Risk profile of an address',
    prompt:
      'Give me the risk profile (flood, planning history, conservation, listed status) for postcode W14 9JH.',
  },
  {
    label: 'Resale viability',
    prompt:
      'For postcode SK4 3HQ — what’s the demand score, days-on-market, and 5-year capital growth? Worth holding or flipping?',
  },
  {
    label: 'Market intel briefing',
    prompt:
      'Write a 150-word weekly market briefing for our agent partners, drawing on national-data and any major trend you spot.',
  },
];

export default async function ResearchPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const credits = await getAccountCredits().catch(() => null);
  const remaining = credits?.result?.credits_remaining ?? null;
  const total = credits?.result?.credits_total ?? null;
  const plan = credits?.result?.plan ?? null;

  return (
    <>
      <Header
        pages={[{ title: 'Research', url: '/research' }]}
        page="Concierge"
      />
      <main className="mx-auto w-full max-w-5xl space-y-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-semibold text-2xl tracking-tight">
              Bellwoods Concierge
            </h1>
            <p className="max-w-2xl text-muted-foreground text-sm">
              Ask George anything about UK property — comps, demand, agents,
              flood risk, planning history. Powered by PropertyData&rsquo;s
              AI on top of 60+ live data feeds. Co-founders + Paperclip share
              the same brain.
            </p>
          </div>
          {remaining !== null && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-amber-700">
                {plan ? `${plan} plan` : 'PropertyData credits'}
              </p>
              <p className="mt-1 font-serif text-2xl font-semibold text-amber-900">
                {remaining.toLocaleString('en-GB')}
                {total !== null && (
                  <span className="ml-1 text-base font-normal text-amber-700">
                    / {total.toLocaleString('en-GB')}
                  </span>
                )}
              </p>
              <p className="text-xs text-amber-700">remaining this period</p>
            </div>
          )}
        </div>

        <ConciergeChat suggestedPrompts={SUGGESTED_PROMPTS} />

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">
            What this is good for
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
            <li>· <strong>Pre-offer underwriting</strong> — risk, comps, demand in one go</li>
            <li>· <strong>Agent prospecting</strong> — find active firms in any postcode</li>
            <li>· <strong>Resale strategy</strong> — yield, growth, demand for hold-vs-flip</li>
            <li>· <strong>Market intel</strong> — weekly briefings to send to agent partners</li>
            <li>· <strong>Investor packs</strong> — synthesise yield + comps + risk into a one-pager</li>
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            Heavy lifting is wired into the offer engine separately — see{' '}
            <code className="rounded bg-white px-1 py-0.5">
              docs/setup/propertydata.md
            </code>
            . This is the chat surface for ad-hoc questions.
          </p>
        </div>
      </main>
    </>
  );
}
