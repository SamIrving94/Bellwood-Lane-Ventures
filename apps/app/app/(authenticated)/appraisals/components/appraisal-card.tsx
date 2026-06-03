import Link from 'next/link';
import type {
  AppraisalMetadata,
  Comparable,
  EnvironmentalRisk,
} from './types';

type Props = {
  actionId: string;
  createdAt: Date;
  priority: string;
  title: string;
  metadata: unknown;
};

function poundsDisplay(pence: number): string {
  return `£${Math.round(pence / 100).toLocaleString('en-GB')}`;
}

const VERDICT_STYLE: Record<string, string> = {
  bid: 'bg-emerald-100 text-emerald-900',
  walk: 'bg-rose-100 text-rose-900',
  bid_with_caveats: 'bg-amber-100 text-amber-900',
  further_investigation: 'bg-slate-100 text-slate-900',
};

const RISK_RATING_STYLE: Record<string, string> = {
  high: 'bg-rose-100 text-rose-800 border-rose-200',
  'medium-high': 'bg-amber-100 text-amber-800 border-amber-200',
  medium: 'bg-amber-50 text-amber-800 border-amber-200',
  'medium-low': 'bg-emerald-50 text-emerald-800 border-emerald-200',
  low: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

const RISK_LABEL: Record<EnvironmentalRisk['risk'], string> = {
  coal_mining: 'Coal mining',
  radon: 'Radon',
  flood: 'Flood',
  knotweed: 'Knotweed',
  noise: 'Noise',
  construction: 'Construction',
};

export function AppraisalCard({
  actionId,
  createdAt,
  priority,
  title,
  metadata,
}: Props) {
  const meta = metadata as AppraisalMetadata | null;
  const ap = meta?.appraisal;

  if (!ap) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        Action {actionId} has no appraisal payload — try regenerating.
      </div>
    );
  }

  const verdictClass = VERDICT_STYLE[ap.recommendation.verdict] ?? 'bg-slate-100';

  return (
    <article className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      {/* Header banner */}
      <header
        data-tour="appraisal-header"
        className="border-b border-slate-200 bg-slate-50/50 p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
              <span
                className={`rounded px-2 py-0.5 font-semibold ${verdictClass}`}
              >
                {ap.recommendation.verdict.replace(/_/g, ' ')}
              </span>
              <span>{ap.property.propertyTypeDescribed}</span>
              <span>·</span>
              <span>
                Created{' '}
                {createdAt.toISOString().slice(0, 16).replace('T', ' ')}
              </span>
              <span>·</span>
              <span>Priority: {priority}</span>
            </div>
            <h2 className="text-lg font-semibold">
              {ap.property.address}, {ap.property.postcode}
            </h2>
            <p className="text-sm text-slate-700">{ap.recommendation.headline}</p>
          </div>
          <div data-tour="appraisal-arv" className="space-y-1 text-right text-sm">
            <div className="text-xs uppercase tracking-wide text-slate-500">
              ARV (point)
            </div>
            <div className="text-xl font-semibold tabular-nums">
              {poundsDisplay(ap.arv.pointEstimatePence)}
            </div>
            <div className="text-xs text-slate-500">
              80% CI {poundsDisplay(ap.arv.ci80LowPence)}–
              {poundsDisplay(ap.arv.ci80HighPence)}
            </div>
            {ap.bidCap && (
              <div className="mt-2 rounded bg-slate-900 px-2 py-1 text-xs font-semibold uppercase text-white">
                Hard cap {poundsDisplay(ap.bidCap.hardCapPence)}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-2">
        {/* §1 Property */}
        <Section title="Property">
          <Field label="Type" value={ap.property.propertyTypeDescribed} />
          {ap.property.floorAreaSqm && (
            <Field label="Floor area" value={`${ap.property.floorAreaSqm} m²`} />
          )}
          {ap.property.epcRating && (
            <Field label="EPC" value={ap.property.epcRating} />
          )}
          {ap.property.councilTaxBand && (
            <Field label="Council tax" value={ap.property.councilTaxBand} />
          )}
          {ap.property.refurbishmentSignals.length > 0 && (
            <div className="mt-2">
              <div className="text-xs uppercase tracking-wide text-slate-500">
                Refurbishment signals
              </div>
              <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">
                {ap.property.refurbishmentSignals.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </Section>

        {/* §3 ARV */}
        <Section title="ARV">
          <Field
            label="Point estimate"
            value={poundsDisplay(ap.arv.pointEstimatePence)}
          />
          <Field
            label="50% CI"
            value={`${poundsDisplay(ap.arv.ci50LowPence)} – ${poundsDisplay(ap.arv.ci50HighPence)}`}
          />
          <Field
            label="80% CI"
            value={`${poundsDisplay(ap.arv.ci80LowPence)} – ${poundsDisplay(ap.arv.ci80HighPence)}`}
          />
          <p className="mt-2 text-sm text-slate-700">{ap.arv.reasoning}</p>
        </Section>

        {/* §2 Comparables */}
        <div data-tour="appraisal-comparables" className="md:col-span-2">
          <Section title="Comparables">
            <p className="mb-2 text-xs text-slate-500">
              {ap.comparables.methodology}
              {ap.comparables.postcodeAvgPence && (
                <span>
                  {' '}
                  Postcode avg{' '}
                  <strong>{poundsDisplay(ap.comparables.postcodeAvgPence)}</strong>.
                </span>
              )}
            </p>
            <ComparablesTable rows={ap.comparables.selected} />
          </Section>
        </div>

        {/* §5 Environmental */}
        <div data-tour="appraisal-environment" className="md:col-span-2">
          <Section title="Environmental risk">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {ap.environment.map((risk, i) => (
                <div
                  key={i}
                  className={`rounded border p-3 text-sm ${RISK_RATING_STYLE[risk.rating] ?? 'border-slate-200'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">
                      {RISK_LABEL[risk.risk] ?? risk.risk}
                    </span>
                    <span className="text-xs uppercase tracking-wide">
                      {risk.rating}
                      {risk.material && ' · MATERIAL'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs">{risk.notes}</p>
                </div>
              ))}
            </div>
          </Section>
        </div>

        {/* §4 Condition */}
        <Section title="Condition flags">
          <FlagList label="Green" items={ap.condition.greenFlags} tone="emerald" />
          <FlagList label="Amber" items={ap.condition.amberFlags} tone="amber" />
          <FlagList
            label="Unverified"
            items={ap.condition.unverified}
            tone="slate"
          />
        </Section>

        {/* §6 Bid cap */}
        {ap.bidCap && (
          <Section title="Risk-adjusted bid cap">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr>
                  <th className="py-1">Line</th>
                  <th className="py-1 text-right">% off ARV</th>
                </tr>
              </thead>
              <tbody>
                {ap.bidCap.discountStack.map((line, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="py-1">
                      <div>{line.label}</div>
                      <div className="text-xs text-slate-500">
                        {line.reasoning}
                      </div>
                    </td>
                    <td className="py-1 text-right font-mono">
                      −{line.percent}%
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-slate-200 font-semibold">
                  <td className="py-2">Total deduction</td>
                  <td className="py-2 text-right font-mono">
                    −{ap.bidCap.totalDeductionPercent}%
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="mt-3 rounded bg-slate-50 p-3 text-sm">
              <div>
                <strong>Hard cap:</strong> {poundsDisplay(ap.bidCap.hardCapPence)}
              </div>
              <div>
                <strong>Soft target:</strong>{' '}
                {poundsDisplay(ap.bidCap.softTargetPence)}
              </div>
              {ap.bidCap.probabilityOfWinningPercent !== null && (
                <div>
                  <strong>Probability of winning under cap:</strong>{' '}
                  {ap.bidCap.probabilityOfWinningPercent}%
                </div>
              )}
            </div>
          </Section>
        )}

        {/* §8 Pre-actions */}
        <Section title="Pre-action checklist">
          {ap.preAuctionActions.length === 0 ? (
            <p className="text-xs text-slate-500">No pre-actions identified.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {ap.preAuctionActions.map((act, i) => (
                <li key={i} className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    disabled
                    className="mt-1"
                    aria-label="action"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {act.blocking && (
                        <span className="rounded bg-rose-100 px-1.5 py-0.5 text-xs text-rose-800">
                          blocking
                        </span>
                      )}
                      <span>{act.action}</span>
                    </div>
                    {act.deadline && (
                      <div className="text-xs text-slate-500">
                        by {act.deadline}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* §9 Confidence + escalations */}
        <div data-tour="appraisal-escalations">
        <Section title="Confidence">
          <Field
            label="Estimated error"
            value={`±${ap.confidence.estimatedErrorPercent.toFixed(1)}%`}
          />
          <Field label="Level" value={ap.confidence.level} />
          {ap.confidence.drivers.length > 0 && (
            <div className="mt-2">
              <div className="text-xs uppercase tracking-wide text-slate-500">
                Drivers
              </div>
              <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">
                {ap.confidence.drivers.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          )}
          {ap.escalations.length > 0 && (
            <div className="mt-3 rounded border border-rose-200 bg-rose-50 p-2 text-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-rose-800">
                Escalations
              </div>
              <ul className="mt-1 list-disc pl-5 text-rose-900">
                {ap.escalations.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </Section>
        </div>
      </div>

      {/* Footer */}
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/50 px-5 py-3 text-xs text-slate-500">
        <div className="flex items-center gap-3">
          {meta?.listingUrl && (
            <a
              href={meta.listingUrl}
              target="_blank"
              rel="noreferrer"
              className="underline-offset-2 hover:underline"
            >
              Listing
            </a>
          )}
          {meta?.kind === 'lead' && meta.entityId && (
            <Link
              href={`/leads/${meta.entityId}`}
              className="underline-offset-2 hover:underline"
            >
              View lead
            </Link>
          )}
          <Link
            href="/actions"
            className="underline-offset-2 hover:underline"
          >
            Action centre
          </Link>
        </div>
        <span>Action {actionId.slice(0, 10)}…</span>
      </footer>
    </article>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Sub-components
// ───────────────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded border border-slate-200 p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">{title}</h3>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

function FlagList({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: 'emerald' | 'amber' | 'slate';
}) {
  const accent =
    tone === 'emerald'
      ? 'text-emerald-700'
      : tone === 'amber'
        ? 'text-amber-700'
        : 'text-slate-600';
  if (items.length === 0) return null;
  return (
    <div className="mt-2">
      <div className={`text-xs uppercase tracking-wide ${accent}`}>{label}</div>
      <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

function ComparablesTable({ rows }: { rows: Comparable[] }) {
  if (rows.length === 0) {
    return <p className="text-xs text-slate-500">No comparables returned.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="text-left text-xs text-slate-500">
          <tr>
            <th className="py-1 pr-3">Address</th>
            <th className="py-1 pr-3">Date</th>
            <th className="py-1 pr-3 text-right">Price</th>
            <th className="py-1 pr-3 text-right">£/m²</th>
            <th className="py-1">Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c, i) => (
            <tr
              key={i}
              className={`border-t border-slate-100 ${
                c.excluded ? 'opacity-50' : ''
              } ${c.cleanestMatch ? 'bg-emerald-50/50' : ''}`}
            >
              <td className="py-1 pr-3">
                {c.cleanestMatch && (
                  <span className="mr-1 rounded bg-emerald-200 px-1 text-xs">
                    BEST
                  </span>
                )}
                {c.excluded && (
                  <span className="mr-1 rounded bg-rose-100 px-1 text-xs">
                    OUT
                  </span>
                )}
                {c.address}
              </td>
              <td className="py-1 pr-3 whitespace-nowrap">{c.saleDate}</td>
              <td className="py-1 pr-3 text-right font-mono">
                {poundsDisplay(c.pricePence)}
              </td>
              <td className="py-1 pr-3 text-right font-mono text-xs">
                {c.pricePerSqm ? `£${c.pricePerSqm.toLocaleString('en-GB')}` : '—'}
              </td>
              <td className="py-1 text-xs text-slate-500">
                {c.excluded && c.exclusionReason
                  ? `Excluded: ${c.exclusionReason}`
                  : c.notes}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
