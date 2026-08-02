import { StatusNote } from '@/components/brand';

/**
 * A static mock of the live deal timeline (`/track/[token]`) — the shared
 * chain view every party sees. This is the agent-facing signature artefact:
 * one page, no login, identical for seller, agent and solicitor. Rendered as
 * a document-style card to match the offer-letter artefact language.
 */

const STEPS: Array<{
  t: string;
  d: string;
  when: string;
  done: boolean;
}> = [
  {
    t: 'Offer accepted',
    d: 'Signed offer countersigned by the seller.',
    when: 'Mon 09:12',
    done: true,
  },
  {
    t: 'Solicitors instructed',
    d: 'Both sides instructed. Proof of funds shared.',
    when: 'Mon 16:40',
    done: true,
  },
  {
    t: 'Searches ordered',
    d: 'Local authority and drainage searches submitted.',
    when: 'Tue 10:05',
    done: true,
  },
  {
    t: 'Survey booked',
    d: 'RICS survey arranged with the seller.',
    when: 'Thu, agreed with seller',
    done: false,
  },
  {
    t: 'Exchange',
    d: 'Target date agreed by both solicitors.',
    when: 'Ahead',
    done: false,
  },
];

export function TimelineMock() {
  return (
    <div className="w-full max-w-[400px] rounded-[2px] border border-hair bg-cream p-6 shadow-[0_28px_52px_-24px_rgba(36,28,26,0.4)]">
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-bold font-serif text-[15px] text-brand-deep">
          Live timeline
        </p>
        <p className="text-[11px] text-stone-400 [font-family:var(--font-courier)]">
          Sample &middot; no login
        </p>
      </div>
      <p className="mt-1 text-[12px] text-stone-500 [font-family:var(--font-courier)]">
        14 Acacia Avenue, Stockport SK4 3HQ
      </p>
      <ol className="mt-5 space-y-0 border-hair border-t pt-4">
        {STEPS.map((s) => (
          <li key={s.t} className="relative flex gap-4 pb-5 last:pb-0">
            <span
              aria-hidden
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                s.done ? 'bg-leaf' : 'border border-stone-300 bg-transparent'
              }`}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-4">
                <p
                  className={`font-serif text-[14px] ${
                    s.done ? 'text-forest' : 'text-stone-400'
                  }`}
                >
                  {s.t}
                </p>
                <p className="shrink-0 text-[10.5px] text-stone-400 [font-family:var(--font-courier)]">
                  {s.when}
                </p>
              </div>
              <p className="mt-0.5 text-[12px] text-stone-500 leading-relaxed">
                {s.d}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-4 border-hair border-t pt-4">
        <StatusNote>Seller, agent and solicitor see this same page.</StatusNote>
      </div>
    </div>
  );
}
