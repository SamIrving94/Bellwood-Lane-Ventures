import type { Metadata } from 'next';
import { Header } from '../components/header';

export const metadata: Metadata = {
  title: 'Guide — Bellwood Ventures',
  description: 'How to move around the app and use each part of it.',
};

// ─────────────────────────────────────────────────────────────────────────
// LIVING GUIDE — update this on every release.
// 1. Add a dated entry to CHANGELOG (newest first).
// 2. Update the relevant SECTION if a workflow changed.
// Keep it plain: short lines, bold the thing you click.
// ─────────────────────────────────────────────────────────────────────────

const LAST_UPDATED = '30 May 2026';

const CHANGELOG: { date: string; items: string[] }[] = [
  {
    date: '30 May 2026',
    items: [
      'Investor access links — give an investor a read-only link to the public deal feed.',
      'Sourcing fee tracking on released deals (proposed → agreed → invoiced → paid).',
      'Book — trade P&L dashboard for deals we buy.',
      'Trade economics panel on each deal (what we paid, costs, what we sold for).',
    ],
  },
  {
    date: 'Earlier',
    items: [
      'Generate suggested offer on a deal, with a tunable offer policy.',
      'Pass & release a deal to the investor feed.',
      'Investor interest + progress updates on released deals.',
    ],
  },
];

type Section = {
  nav: string;
  what: string;
  steps: string[];
};

const SECTIONS: Section[] = [
  {
    nav: 'Today',
    what: 'Your daily start. Shows decisions waiting on you and leads found overnight.',
    steps: [
      'Open this first each morning.',
      'Clear anything under **Needs your decision**.',
      'Skim **New leads overnight** and open any worth chasing.',
    ],
  },
  {
    nav: 'Leads',
    what: 'Scouted opportunities before they become deals. Each has a score and a verdict.',
    steps: [
      'Open a lead to see why it scored the way it did.',
      'Use the contact routes (agent, Land Registry, write to the property) to reach the owner.',
      'Press **Convert to deal** when it is worth pursuing — it moves into the Pipeline.',
    ],
  },
  {
    nav: 'Pipeline',
    what: 'Every live deal, grouped by stage. This is the core of the business.',
    steps: [
      'Use **Add deal** to enter a deal by hand (including past deals you closed off-system).',
      'Click any deal to open its full page.',
    ],
  },
  {
    nav: 'Deal page',
    what: 'The workhorse. Everything about one deal lives here.',
    steps: [
      '**Generate suggested offer** — runs the valuation and proposes our offer. **Tune offer policy** changes the margins it uses.',
      '**Trade economics** — once we buy it, record what we paid, costs, and what we sold for. Shows realised profit.',
      '**Pass & release** — only once we have passed on the deal for our own book. This adds it to the investor feed.',
      'After release: **Investor interest** (log who is interested, send updates) and **Sourcing fee** (track the fee an investor pays).',
    ],
  },
  {
    nav: 'Book',
    what: 'The trade track record — every deal we have put money into, with realised profit.',
    steps: [
      'Top cards: realised profit, blended ROI, win rate, capital deployed, deals exited.',
      'To add a past deal: add it in **Pipeline**, open it, then fill **Trade economics**.',
      'A deal appears here as soon as you record an acquisition price.',
    ],
  },
  {
    nav: 'Investors',
    what: 'Deals we have released, plus the tools to share them and track fees.',
    steps: [
      '**Investor access links** — create a read-only link for an investor. It is copied to your clipboard. **Revoke** any link any time.',
      'The **fee pipeline** cards show fees paid, agreed/invoiced, and proposed.',
      'Seller contact details are never shown on this feed.',
    ],
  },
  {
    nav: 'Outreach',
    what: 'People, campaigns, inbox and templates for contacting sellers.',
    steps: [
      'Switch with the tabs at the top.',
      '**People** — your contacts (add with the button).',
      '**Campaigns**, **Inbox** and **Templates** hold targeted outreach and replies.',
    ],
  },
  {
    nav: 'Settings',
    what: 'Account and app settings.',
    steps: ['Open from the bottom of the sidebar.'],
  },
];

// Tiny renderer: turns **bold** into <strong> so steps stay readable in code.
function renderEmphasis(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i} className="font-semibold text-foreground">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

const GuidePage = () => {
  return (
    <>
      <Header pages={[]} page="Guide" />
      <main className="mx-auto w-full max-w-3xl space-y-8 p-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            How to use Bellwood
          </p>
          <h1 className="mt-1 font-semibold text-2xl tracking-tight">Guide</h1>
          <p className="mt-2 text-muted-foreground text-sm">
            A plain walkthrough of the app, section by section. Updated every
            release. Last updated{' '}
            <span className="font-medium text-foreground">{LAST_UPDATED}</span>.
          </p>
        </div>

        {/* Key rule */}
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
          <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-300">
            The one rule
          </h2>
          <p className="mt-1 text-sm text-amber-900/90 dark:text-amber-200/90">
            A deal is only shared with investors{' '}
            <span className="font-semibold">after</span> we have passed on it
            for our own book. Nothing leaves the pipeline until you press{' '}
            <span className="font-semibold">Pass &amp; release</span>.
          </p>
        </div>

        {/* What's new */}
        <section>
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            What&apos;s new
          </h2>
          <div className="mt-3 space-y-4">
            {CHANGELOG.map((entry) => (
              <div key={entry.date}>
                <p className="text-xs font-semibold">{entry.date}</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {entry.items.map((it, i) => (
                    <li key={i}>{it}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Sections */}
        <section className="space-y-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Around the app
          </h2>
          {SECTIONS.map((s) => (
            <div key={s.nav} className="rounded-xl border bg-card p-5">
              <h3 className="font-semibold">{s.nav}</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">{s.what}</p>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm">
                {s.steps.map((step, i) => (
                  <li key={i}>{renderEmphasis(step)}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      </main>
    </>
  );
};

export default GuidePage;
