/**
 * AVM backtest runner — measure AVM accuracy against realized sale prices.
 *
 *   pnpm tsx scripts/avm-backtest.mts
 *
 * Pairs every stored AvmResult (its `avmPointEstimate` + 80% interval) with the
 * realized market-value actual on the linked Deal, then prints error (MAPE /
 * MAE / median APE), directional bias, and interval coverage — i.e. is the
 * "80%" band actually ~80%? The scoring core is the pure, unit-tested
 * `computeBacktest` in @repo/valuation; this script only assembles the pairs.
 *
 * Actual = Deal.exitPricePence (resale ≈ market value) by default. Acquisition
 * price is what we *paid* (a discounted purchase), not market value, so it is
 * reported separately for context but not used as the AVM target. As more deals
 * complete — or once the closed-deal price dataset is loaded — the sample size
 * grows automatically; no code change needed.
 */

import { PrismaClient } from '../packages/database/generated/client/index.js';
import type { BacktestSample } from '../packages/valuation/src/backtest.js';
import * as BacktestNs from '../packages/valuation/src/backtest.js';

// @repo/valuation has no `"type": "module"`, so when this standalone ESM script
// loads the TS source via tsx it arrives CJS-wrapped: the named exports land
// under `default`. Unwrap that (with a fallback for if the package ever becomes
// ESM-native) rather than relying on the named-import shape.
const { computeBacktestBySegment } = ((
  BacktestNs as { default?: typeof BacktestNs }
).default ?? BacktestNs) as typeof BacktestNs;

const db = new PrismaClient();

type AvmJson = {
  avmPointEstimate?: number;
  avmLow?: number;
  avmHigh?: number;
  confidenceLevel?: string;
};

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function gbp(pence: number): string {
  return `£${Math.round(pence / 100).toLocaleString('en-GB')}`;
}

async function main() {
  const results = await db.avmResult.findMany({
    where: { dealId: { not: null } },
    select: {
      postcode: true,
      propertyType: true,
      resultJson: true,
      createdAt: true,
      deal: {
        select: {
          id: true,
          status: true,
          exitPricePence: true,
          acquisitionPricePence: true,
          estimatedMarketValuePence: true,
        },
      },
    },
  });

  const samples: BacktestSample[] = [];
  let withExit = 0;
  let withAcquisition = 0;

  for (const r of results) {
    const json = (r.resultJson ?? {}) as AvmJson;
    const predicted = json.avmPointEstimate;
    const actual = r.deal?.exitPricePence ?? null;
    if (r.deal?.exitPricePence != null) withExit++;
    if (r.deal?.acquisitionPricePence != null) withAcquisition++;

    if (typeof predicted === 'number' && actual != null && actual > 0) {
      samples.push({
        predictedPence: predicted,
        actualPence: actual,
        intervalLowPence: json.avmLow ?? null,
        intervalHighPence: json.avmHigh ?? null,
        segment: json.confidenceLevel ?? 'unknown',
      });
    }
  }

  console.log('=== AVM backtest ===');
  console.log('AvmResults linked to a deal: ', results.length);
  console.log('  …with a resale (exit) price:', withExit);
  console.log('  …with an acquisition price: ', withAcquisition);
  console.log('Usable (predicted vs exit) pairs:', samples.length);
  console.log('');

  if (samples.length === 0) {
    console.log(
      'No realized outcomes to score yet — the harness is ready and will'
    );
    console.log(
      'produce numbers as soon as deals carry an exitPricePence (or the'
    );
    console.log('closed-deal price dataset is loaded).');
    return;
  }

  const { overall, segments } = computeBacktestBySegment(samples);

  const printReport = (label: string, rep: typeof overall) => {
    console.log(`-- ${label} (n=${rep.n}) --`);
    console.log('  MAPE:            ', pct(rep.mape));
    console.log('  Median APE:      ', pct(rep.medianApe));
    console.log('  MAE:             ', gbp(rep.maePence));
    console.log(
      '  Bias:            ',
      `${rep.biasPct >= 0 ? '+' : ''}${pct(rep.biasPct)} ${rep.biasPct >= 0 ? '(over-valuing)' : '(under-valuing)'}`
    );
    console.log(
      '  80% interval hit:',
      rep.intervalCoverage == null
        ? 'n/a'
        : `${pct(rep.intervalCoverage)} over ${rep.intervalSampleCount} (target ~80%)`
    );
    console.log('');
  };

  printReport('Overall', overall);
  for (const [seg, rep] of Object.entries(segments)) {
    printReport(`Confidence: ${seg}`, rep);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
