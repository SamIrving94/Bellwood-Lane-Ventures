import { VALUATION_CONFIG_KEY } from '@/app/actions/valuation-config/save';
import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import { mergeValuationConfig } from '@repo/valuation';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Header } from '../../components/header';
import { MethodologyEditor } from './methodology-editor';

export const metadata: Metadata = {
  title: 'Valuation methodology — Bellwood Lane',
  description: 'How we value a deal: the maths, the data, the rules.',
};

export const dynamic = 'force-dynamic';

function Section({
  step,
  title,
  children,
}: {
  step: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 font-mono text-[11px] text-white">
          {step}
        </span>
        <h2 className="font-semibold text-lg">{title}</h2>
      </div>
      <div className="mt-3 space-y-2 text-muted-foreground text-sm">
        {children}
      </div>
    </section>
  );
}

export default async function ValuationMethodologyPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const row = await database.setting.findUnique({
    where: { key: VALUATION_CONFIG_KEY },
  });
  const config = mergeValuationConfig(row?.value ?? null);

  return (
    <>
      <Header pages={[]} page="Valuation methodology" />
      <div className="mx-auto flex max-w-4xl flex-1 flex-col gap-6 p-6">
        <div>
          <h1 className="font-semibold text-2xl">Valuation methodology</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            How the platform values a deal — the approach, the maths, the data
            it needs, and the rules. Every lever in the grey panel at the bottom
            is editable and feeds the live engine.
          </p>
        </div>

        {/* ── The document ─────────────────────────────────────────────── */}
        <div className="space-y-4">
          <Section step="•" title="The approach in one line">
            <p>
              We underwrite <strong>bottom-up</strong>: start from the{' '}
              <strong>end value</strong>, take off <strong>every cost</strong>,
              and see the profit, the return, and the most we can pay. The
              system does the data-gathering and the arithmetic; the founder
              owns the final judgement calls (refurb scope, whether to bid).
            </p>
          </Section>

          <Section step="1" title="Market value (the AVM)">
            <p>
              <strong>What:</strong> an automated estimate of what the property
              is worth in <em>normal, sellable</em> condition.
            </p>
            <p>
              <strong>Data:</strong> recent <strong>sold prices</strong> from HM
              Land Registry for comparable properties nearby — weighted by how
              close and how recent they are (closer + more recent counts more).
            </p>
            <p>
              <strong>Maths:</strong> a distance- and time-weighted median of
              the comparable sales, adjusted to the subject&rsquo;s size and
              type. We also keep a low–high range and a confidence level based
              on how many comparables we found and how tightly they agree.
            </p>
            <p>
              <strong>Rule:</strong> the comparables are normal-condition sales,
              so the AVM is effectively the <em>done-up</em> value — which is
              why it anchors the GDV (step 4).
            </p>
          </Section>

          <Section step="2" title="Condition (read from the photos)">
            <p>
              <strong>What:</strong> an AI looks at the listing photo and rates
              the condition —{' '}
              <em>pristine, fair, tired, distressed, derelict</em> — and flags
              specific problems (no kitchen, damp, roof damage, structural,
              etc.).
            </p>
            <p>
              <strong>Data:</strong> the property photo(s). With one photo
              it&rsquo;s a starting read, not a survey — confidence is shown,
              and you can override it.
            </p>
            <p>
              <strong>Rule:</strong> condition drives both the current value
              (step 3) and the refurb cost (step 5).
            </p>
          </Section>

          <Section step="3" title="As-is value (what it&rsquo;s worth today)">
            <p>
              <strong>Maths:</strong> As-is = AVM × (1 − condition discount).
            </p>
            <p>
              <strong>Current discounts:</strong>{' '}
              {Object.entries(config.conditionDiscounts)
                .map(([k, v]) => `${k} ${Math.round(v * 100)}%`)
                .join(' · ')}
              .
            </p>
            <p>
              <strong>Why:</strong> a tired flat is worth less than the comp
              median until it&rsquo;s brought up to standard. The margin is made
              buying <em>below</em> this number.
            </p>
          </Section>

          <Section step="4" title="GDV (end value after refurb)">
            <p>
              <strong>Maths:</strong> GDV = AVM × (1 + refurb uplift). Uplift is
              0% for a standard refurb that just restores it to the comp
              baseline; raise it only when the works add real value (extra
              bedroom, extension).
            </p>
            <p>
              <strong>Why:</strong> refurbishing to normal makes it worth the
              same as the comparable normal homes — i.e. the AVM. You
              don&rsquo;t beat the AVM unless you add something.
            </p>
          </Section>

          <Section step="5" title="Refurb cost (built from the photos)">
            <p>
              <strong>Maths:</strong> Base = £/m² for the condition × floor area
              (from EPC; an assumed area is used and flagged when missing). Then
              a line is added for each flagged defect.
            </p>
            <p>
              <strong>Current base rates:</strong>{' '}
              {Object.entries(config.refurbPerSqm)
                .map(([k, v]) => `${k} £${Math.round(v / 100)}/m²`)
                .join(' · ')}
              .
            </p>
            <p>
              <strong>Rule:</strong> the breakdown is shown line-by-line on the
              deal panel (&ldquo;show working&rdquo;) so it can be trusted and
              edited. Missing kitchen/bathroom aren&rsquo;t double-counted on
              distressed/derelict (the heavy base already covers them).
            </p>
          </Section>

          <Section step="6" title="The deal model (costs → profit → ROI)">
            <p>
              <strong>Maths:</strong> Profit = GDV − purchase price − all costs.
              Costs include <strong>SDLT</strong> (real UK bands + 5%
              additional-property surcharge), legals, any auction buyer fee,
              refurb (+ contingency), lease extension if needed, and selling
              costs.
            </p>
            <p>
              <strong>Two returns:</strong> <strong>cash ROI</strong> (profit ÷
              total cash in — the gate) and <strong>financed ROI</strong>{' '}
              (profit after finance ÷ cash invested — the bridging upside).
            </p>
            <p>
              <strong>Data:</strong> the price is our input; SDLT is computed
              from it; the other costs are standard assumptions.
            </p>
          </Section>

          <Section step="7" title="The most we can pay (max offer)">
            <p>
              <strong>Maths:</strong> the system tries different offer prices
              and finds the highest one that still clears our target return —
              currently{' '}
              <strong>
                {Math.round(config.targetCashRoi * 100)}% cash ROI
              </strong>
              . That&rsquo;s the walk-away ceiling.
            </p>
          </Section>

          <Section step="✓" title="Data vs assumption vs judgement">
            <p>
              <strong>Hard data:</strong> end value (sold prices), stamp duty
              (real rules).
            </p>
            <p>
              <strong>Standard assumptions:</strong> legals, fees, selling
              costs, the £/m² and defect costs below.
            </p>
            <p>
              <strong>Your judgement:</strong> refurb scope and the final bid —
              the system gives a defensible starting point, you make the call.
            </p>
          </Section>
        </div>

        {/* ── The control panel ────────────────────────────────────────── */}
        <div className="rounded-2xl border-2 border-slate-900/10 bg-slate-50 p-5">
          <h2 className="font-semibold text-lg">Tune the levers</h2>
          <p className="mt-1 mb-4 text-muted-foreground text-sm">
            These are the judgement-call numbers behind the maths above. Edit
            them here and they feed every new valuation — calibrate against real
            deals over time.
          </p>
          <MethodologyEditor config={config} />
        </div>
      </div>
    </>
  );
}
