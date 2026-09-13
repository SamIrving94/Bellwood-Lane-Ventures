import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Header } from '../../components/header';

export const metadata: Metadata = {
  title: 'AVM accuracy — Kept',
  description:
    'How the valuation engine has performed against later Land Registry sales.',
};

export const dynamic = 'force-dynamic';

/**
 * /appraisals/backtest — is the AVM any good?
 *
 * Reads the cohort /cron/avm-backtest maintains: every appraisal frozen at
 * decision time, matched monthly to the property's first Land Registry sale
 * after it. Shows the latest roll-up (overall + by confidence, comps path,
 * source, price band, engine version) and the most recent matched sales so
 * a number can be traced to a house.
 *
 * Sample-size honesty is the page's job: under 30 matched sales it says
 * "too few", under 200 it says "directional".
 */

type Report = {
  n: number;
  mape: number;
  medianApe: number;
  biasPct: number;
  medianSignedPct: number;
  withinPct10: number;
  withinPct20: number;
  intervalCoverage: number | null;
  intervalSampleCount: number;
};

type Summary = {
  n: number;
  overall: Report;
  byConfidence: Record<string, Report>;
  bySource: Record<string, Report>;
  byPropertyType: Record<string, Report>;
  byCsaSource: Record<string, Report>;
  byPriceBand: Record<string, Report>;
  byEngineVersion: Record<string, Report>;
};

type Payload = {
  runId?: string;
  monthLabel?: string;
  thisRun?: {
    checked: number;
    matched: number;
    expired: number;
    excluded: number;
    postcodesQueried: number;
    postcodesDeferred?: number;
    hmlrErrors: number;
  };
  cohort?: { pending: number; matched: number; excluded: number; expired: number };
  summary?: Summary;
};

const pct = (f: number | null | undefined, dp = 1) =>
  f == null ? '—' : `${(f * 100).toFixed(dp)}%`;
const signedPct = (f: number | null | undefined) =>
  f == null ? '—' : `${f >= 0 ? '+' : ''}${(f * 100).toFixed(1)}%`;
const gbp = (pence: number) =>
  `£${Math.round(pence / 100).toLocaleString('en-GB')}`;
const dateOnly = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '—');

const BAND_LABELS: Record<string, string> = {
  under_250k: 'Under £250k',
  '250k_500k': '£250k–£500k',
  '500k_1m': '£500k–£1m',
  over_1m: 'Over £1m',
};
const CSA_LABELS: Record<string, string> = {
  distance: 'Radius comps',
  hmlr: 'Postcode comps',
  synthetic: 'No comps (fallback)',
};
const SOURCE_LABELS: Record<string, string> = {
  scout_lead: 'Scout leads',
  deal: 'Deals',
  quote: 'Public quotes',
  batch: 'Batch uploads',
  backfill: 'Backfill',
};

const SegmentTable = ({
  title,
  rows,
  labels,
}: {
  title: string;
  rows: Record<string, Report>;
  labels?: Record<string, string>;
}) => {
  const entries = Object.entries(rows).sort((a, b) => b[1].n - a[1].n);
  if (entries.length === 0) return null;
  return (
    <section className="rounded-lg border bg-card">
      <h2 className="border-b px-4 py-3 font-semibold text-sm">{title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-muted-foreground text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2 text-left">Segment</th>
              <th className="px-4 py-2 text-right">Sales</th>
              <th className="px-4 py-2 text-right">Median error</th>
              <th className="px-4 py-2 text-right">Median bias</th>
              <th className="px-4 py-2 text-right">Within 10%</th>
              <th className="px-4 py-2 text-right">Range caught</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([key, r]) => (
              <tr key={key} className="border-t">
                <td className="px-4 py-2">{labels?.[key] ?? key}</td>
                <td className="px-4 py-2 text-right tabular-nums">{r.n}</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {pct(r.medianApe)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {signedPct(r.medianSignedPct)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {pct(r.withinPct10, 0)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {pct(r.intervalCoverage, 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-4 py-2 text-muted-foreground text-xs">
        Read a segment only once it has about 100 sales.
      </p>
    </section>
  );
};

const Tile = ({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) => (
  <div className="rounded-lg border bg-card px-4 py-3">
    <p className="text-muted-foreground text-xs uppercase tracking-wide">
      {label}
    </p>
    <p className="mt-1 font-semibold text-2xl tabular-nums">{value}</p>
    {hint ? <p className="mt-1 text-muted-foreground text-xs">{hint}</p> : null}
  </div>
);

const BacktestPage = async () => {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const [latest, counts, recent] = await Promise.all([
    database.agentEvent.findFirst({
      where: { eventType: 'avm_backtest' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, payload: true },
    }),
    database.avmSnapshot.groupBy({
      by: ['matchStatus'],
      _count: { _all: true },
    }),
    database.avmSnapshot.findMany({
      where: { matchStatus: 'matched' },
      orderBy: { matchedAt: 'desc' },
      take: 40,
      select: {
        id: true,
        address: true,
        postcode: true,
        source: true,
        appraisedAt: true,
        pointEstimatePence: true,
        lowPence: true,
        highPence: true,
        confidenceLevel: true,
        soldPricePence: true,
        soldDate: true,
        engineVersion: true,
      },
    }),
  ]);

  const countOf = (status: string) =>
    counts.find((c) => c.matchStatus === status)?._count._all ?? 0;
  const cohort = {
    pending: countOf('pending'),
    matched: countOf('matched'),
    excluded: countOf('excluded'),
    expired: countOf('expired'),
  };
  const frozen =
    cohort.pending + cohort.matched + cohort.excluded + cohort.expired;

  const payload = (latest?.payload ?? null) as Payload | null;
  const summary = payload?.summary ?? null;
  const overall = summary?.overall ?? null;

  const verdict =
    !overall || overall.n < 30
      ? 'Too few matched sales to read yet. Every appraisal is frozen and checked monthly; this fills in on its own.'
      : overall.n < 200
        ? 'Directional only. Trust the headline once 200+ sales have matched.'
        : 'Sample is large enough to act on.';

  return (
    <>
      <Header
        pages={[{ title: 'Deep appraisals', url: '/appraisals' }]}
        page="AVM accuracy"
      />
      <main className="mx-auto w-full max-w-5xl space-y-6 p-6">
        <div>
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.22em]">
            Appraisals · Backtest
          </p>
          <h1 className="mt-1 font-semibold text-2xl tracking-tight">
            Is the valuation engine any good?
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground text-sm">
            Every appraisal is frozen the moment it is made. Once a month the
            engine's number is checked against the property's first Land
            Registry sale after that date, for homes we did not buy. Median
            error is the headline. Bias says which way it leans.
          </p>
          <p className="mt-2 max-w-2xl text-sm">{verdict}</p>
          {latest ? (
            <p className="mt-1 text-muted-foreground text-xs">
              Last checked {dateOnly(latest.createdAt)}
              {payload?.thisRun
                ? ` · ${payload.thisRun.matched} new matches · ${payload.thisRun.postcodesQueried} postcodes queried${payload.thisRun.hmlrErrors ? ` · ${payload.thisRun.hmlrErrors} Land Registry errors` : ''}`
                : ''}
            </p>
          ) : (
            <p className="mt-1 text-muted-foreground text-xs">
              The monthly check has not run yet.
            </p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Tile label="Frozen appraisals" value={String(frozen)} />
          <Tile
            label="Waiting for a sale"
            value={String(cohort.pending)}
            hint="Written off after 18 months unsold"
          />
          <Tile label="Matched sales" value={String(cohort.matched)} />
          <Tile
            label="Excluded"
            value={String(cohort.excluded)}
            hint="We bought them — not a market price"
          />
        </div>

        {overall && overall.n > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Tile
              label="Median error"
              value={pct(overall.medianApe)}
              hint="Half the estimates were closer than this"
            />
            <Tile
              label="Median bias"
              value={signedPct(overall.medianSignedPct)}
              hint={
                overall.medianSignedPct > 0.02
                  ? 'Leans high — over-values'
                  : overall.medianSignedPct < -0.02
                    ? 'Leans low — under-values'
                    : 'No lean either way'
              }
            />
            <Tile
              label="Within 10% / 20%"
              value={`${pct(overall.withinPct10, 0)} / ${pct(overall.withinPct20, 0)}`}
            />
            <Tile
              label="Range caught the sale"
              value={pct(overall.intervalCoverage, 0)}
              hint={`Target 80% · ${overall.intervalSampleCount} with a range`}
            />
          </div>
        ) : null}

        {summary ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <SegmentTable title="By confidence label" rows={summary.byConfidence} />
            <SegmentTable
              title="By comps path"
              rows={summary.byCsaSource}
              labels={CSA_LABELS}
            />
            <SegmentTable
              title="By where it came from"
              rows={summary.bySource}
              labels={SOURCE_LABELS}
            />
            <SegmentTable
              title="By sale price"
              rows={summary.byPriceBand}
              labels={BAND_LABELS}
            />
            <SegmentTable title="By property type" rows={summary.byPropertyType} />
            <SegmentTable title="By engine version" rows={summary.byEngineVersion} />
          </div>
        ) : null}

        <section className="rounded-lg border bg-card">
          <h2 className="border-b px-4 py-3 font-semibold text-sm">
            Latest matched sales
          </h2>
          {recent.length === 0 ? (
            <p className="px-4 py-6 text-muted-foreground text-sm">
              No matches yet. A sale takes months to complete and register, so
              the first rows land a few months after the first appraisals.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-muted-foreground text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-2 text-left">Property</th>
                    <th className="px-4 py-2 text-left">Appraised</th>
                    <th className="px-4 py-2 text-right">Estimate</th>
                    <th className="px-4 py-2 text-left">Sold</th>
                    <th className="px-4 py-2 text-right">Price</th>
                    <th className="px-4 py-2 text-right">Error</th>
                    <th className="px-4 py-2 text-left">Conf.</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r) => {
                    const sold = r.soldPricePence ?? 0;
                    const err =
                      sold > 0 ? (r.pointEstimatePence - sold) / sold : null;
                    const inRange =
                      r.lowPence != null &&
                      r.highPence != null &&
                      sold >= r.lowPence &&
                      sold <= r.highPence;
                    return (
                      <tr key={r.id} className="border-t">
                        <td className="px-4 py-2">
                          <div>{r.address || '—'}</div>
                          <div className="text-muted-foreground text-xs">
                            {r.postcode} · {SOURCE_LABELS[r.source] ?? r.source}
                            {r.engineVersion ? ` · ${r.engineVersion}` : ''}
                          </div>
                        </td>
                        <td className="px-4 py-2 tabular-nums">
                          {dateOnly(r.appraisedAt)}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {gbp(r.pointEstimatePence)}
                        </td>
                        <td className="px-4 py-2 tabular-nums">
                          {dateOnly(r.soldDate)}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {sold > 0 ? gbp(sold) : '—'}
                        </td>
                        <td
                          className={`px-4 py-2 text-right tabular-nums ${
                            err != null && Math.abs(err) > 0.1
                              ? 'text-destructive'
                              : ''
                          }`}
                        >
                          {signedPct(err)}
                          {inRange ? '' : err != null ? ' · outside range' : ''}
                        </td>
                        <td className="px-4 py-2">{r.confidenceLevel ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  );
};

export default BacktestPage;
