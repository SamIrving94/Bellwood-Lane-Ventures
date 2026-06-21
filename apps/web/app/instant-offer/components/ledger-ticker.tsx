'use client';

// Horizontal scrolling marquee — recent deal references and quick stats.
// Fed by static seed data for now. Could be wired to live API later.

const TICKER_ITEMS: Array<{ kind: 'deal' | 'stat'; text: string }> = [
  { kind: 'stat', text: 'Typical completion · weeks not months' },
  { kind: 'deal', text: 'M14.PRB.0419 · Manchester probate · £142,000' },
  { kind: 'deal', text: 'BR3.CHN.0402 · Bromley chain break · £318,000' },
  { kind: 'stat', text: 'Price changes since launch · 0 (outside the 3 documented exceptions)' },
  { kind: 'deal', text: 'LS6.SHL.0328 · Leeds short lease · £89,500' },
  { kind: 'stat', text: 'Avg comps used per offer · 47' },
  { kind: 'deal', text: 'B15.RPS.0316 · Birmingham repossession · £164,200' },
  { kind: 'stat', text: 'Founder review on offers under 70% AVM · always' },
  { kind: 'deal', text: 'BS5.PRB.0303 · Bristol probate · £228,800' },
  { kind: 'stat', text: 'Engine median latency · 91ms' },
];

// Repeat for seamless loop
const ITEMS = [...TICKER_ITEMS, ...TICKER_ITEMS];

export function LedgerTicker() {
  return (
    <section
      aria-label="Recent activity"
      className="relative overflow-hidden border-b border-stone-200/60 bg-[#874646] py-3 text-white"
    >
      <div className="ticker-track flex w-max items-center gap-12 whitespace-nowrap">
        {ITEMS.map((item, i) => (
          <div
            key={`${item.text}-${i}`}
            className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.2em]"
          >
            <span
              className="inline-block h-1 w-1 rounded-full"
              style={{
                background: item.kind === 'deal' ? '#DB5C5C' : '#1F6B3A',
              }}
            />
            <span className="text-white/80">{item.text}</span>
          </div>
        ))}
      </div>
      <style>{`
        .ticker-track {
          animation: ticker-scroll 80s linear infinite;
          will-change: transform;
        }
        @keyframes ticker-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ticker-track { animation-duration: 240s; }
        }
      `}</style>
    </section>
  );
}
