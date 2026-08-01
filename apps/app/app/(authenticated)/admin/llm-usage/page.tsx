import { database } from '@repo/database';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * /admin/llm-usage
 *
 * 7-day rollup of every Claude call: spend per feature, success rate,
 * latency, recent failures. Sourced from LlmCallLog, written by the
 * setLlmLogger hook in each app's instrumentation.ts.
 *
 * No PII — metrics only. Safe to share with Counsel or investors.
 */

// USD per 1M tokens — verify against console.anthropic.com/pricing before
// trusting cost figures. These are early-2026 list prices.
const PRICING: Record<string, { in: number; out: number }> = {
  'claude-haiku-4-5': { in: 1, out: 5 },
  'claude-sonnet-4-5': { in: 3, out: 15 },
  'claude-opus-4-7': { in: 15, out: 75 },
};

function estimateUsdCost(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING[model] ?? { in: 3, out: 15 };
  return (inputTokens * p.in + outputTokens * p.out) / 1_000_000;
}

function formatUsd(value: number): string {
  if (value < 0.01) return '<$0.01';
  if (value < 1) return `$${value.toFixed(3)}`;
  return `$${value.toFixed(2)}`;
}

function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

export default async function LlmUsagePage() {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [byFeatureRaw, byFeatureCounts, byModelRaw, recentFailures, totalCalls] = await Promise.all(
    [
      database.llmCallLog.groupBy({
        by: ['feature', 'model'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
        _sum: { inputTokens: true, outputTokens: true, durationMs: true },
        _avg: { durationMs: true },
        _max: { durationMs: true },
      }),
      database.llmCallLog.groupBy({
        by: ['feature', 'success'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      }),
      database.llmCallLog.groupBy({
        by: ['model'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
        _sum: { inputTokens: true, outputTokens: true },
      }),
      database.llmCallLog.findMany({
        where: { success: false, createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          createdAt: true,
          feature: true,
          model: true,
          durationMs: true,
          errorReason: true,
        },
      }),
      database.llmCallLog.count({ where: { createdAt: { gte: since } } }),
    ],
  );

  const successByFeature = new Map<string, { success: number; failure: number }>();
  for (const row of byFeatureCounts) {
    const key = row.feature;
    const entry = successByFeature.get(key) ?? { success: 0, failure: 0 };
    if (row.success) entry.success = row._count._all;
    else entry.failure = row._count._all;
    successByFeature.set(key, entry);
  }

  const totalSpendUsd = byFeatureRaw.reduce(
    (sum, r) =>
      sum +
      estimateUsdCost(r.model, r._sum.inputTokens ?? 0, r._sum.outputTokens ?? 0),
    0,
  );

  const featureRows = [...byFeatureRaw].sort((a, b) => b._count._all - a._count._all);

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">LLM usage — last 7 days</h1>
        <p className="text-sm text-slate-500">
          Per-feature rollup of every Claude call. Metrics only — no prompts
          stored. Pricing figures are early-2026 list prices; verify against{' '}
          <a
            href="https://console.anthropic.com/pricing"
            className="underline"
            target="_blank"
            rel="noreferrer"
          >
            console.anthropic.com/pricing
          </a>
          .
        </p>
      </header>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Total calls" value={totalCalls.toLocaleString('en-GB')} />
        <Stat label="Est. spend" value={formatUsd(totalSpendUsd)} />
        <Stat
          label="Features active"
          value={String(new Set(byFeatureRaw.map((r) => r.feature)).size)}
        />
        <Stat
          label="Models in use"
          value={String(new Set(byFeatureRaw.map((r) => r.model)).size)}
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">By feature</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-3 py-2">Feature</th>
                <th className="px-3 py-2">Model</th>
                <th className="px-3 py-2 text-right">Calls</th>
                <th className="px-3 py-2 text-right">Success</th>
                <th className="px-3 py-2 text-right">In tok</th>
                <th className="px-3 py-2 text-right">Out tok</th>
                <th className="px-3 py-2 text-right">Avg ms</th>
                <th className="px-3 py-2 text-right">Max ms</th>
                <th className="px-3 py-2 text-right">Est $</th>
              </tr>
            </thead>
            <tbody>
              {featureRows.length === 0 && (
                <tr>
                  <td className="px-3 py-6 text-center text-slate-500" colSpan={9}>
                    No LLM calls logged in the last 7 days. If your features
                    are firing, check ANTHROPIC_API_KEY + that
                    instrumentation.ts was deployed.
                  </td>
                </tr>
              )}
              {featureRows.map((row) => {
                const counts = successByFeature.get(row.feature) ?? {
                  success: 0,
                  failure: 0,
                };
                const total = counts.success + counts.failure;
                const successPct =
                  total > 0 ? Math.round((counts.success / total) * 100) : 0;
                const inTok = row._sum.inputTokens ?? 0;
                const outTok = row._sum.outputTokens ?? 0;
                const cost = estimateUsdCost(row.model, inTok, outTok);
                return (
                  <tr
                    key={`${row.feature}__${row.model}`}
                    className="border-t border-slate-100"
                  >
                    <td className="px-3 py-2 font-mono text-xs">{row.feature}</td>
                    <td className="px-3 py-2 font-mono text-xs">{row.model}</td>
                    <td className="px-3 py-2 text-right">
                      {row._count._all.toLocaleString('en-GB')}
                    </td>
                    <td
                      className={`px-3 py-2 text-right ${
                        successPct < 95 ? 'text-rose-600' : 'text-emerald-700'
                      }`}
                    >
                      {successPct}%
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {formatTokens(inTok)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {formatTokens(outTok)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {Math.round(row._avg.durationMs ?? 0)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {row._max.durationMs ?? 0}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {formatUsd(cost)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">By model (spend share)</h2>
        <div className="space-y-1">
          {byModelRaw.length === 0 && (
            <p className="text-sm text-slate-500">No data yet.</p>
          )}
          {byModelRaw
            .map((m) => ({
              model: m.model,
              calls: m._count._all,
              cost: estimateUsdCost(
                m.model,
                m._sum.inputTokens ?? 0,
                m._sum.outputTokens ?? 0,
              ),
            }))
            .sort((a, b) => b.cost - a.cost)
            .map((row) => {
              const pct =
                totalSpendUsd > 0
                  ? Math.round((row.cost / totalSpendUsd) * 100)
                  : 0;
              return (
                <div
                  key={row.model}
                  className="flex items-center gap-3 text-sm"
                >
                  <span className="w-44 font-mono text-xs">{row.model}</span>
                  <span className="w-20 text-right tabular-nums">
                    {row.calls.toLocaleString('en-GB')} calls
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded bg-slate-100">
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-24 text-right font-mono tabular-nums">
                    {formatUsd(row.cost)}
                  </span>
                  <span className="w-10 text-right text-xs text-slate-500">
                    {pct}%
                  </span>
                </div>
              );
            })}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Recent failures</h2>
        {recentFailures.length === 0 ? (
          <p className="text-sm text-emerald-700">
            No failures in the last 7 days. Healthy.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Feature</th>
                  <th className="px-3 py-2">Model</th>
                  <th className="px-3 py-2">Reason</th>
                  <th className="px-3 py-2 text-right">ms</th>
                </tr>
              </thead>
              <tbody>
                {recentFailures.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-mono text-xs">
                      {row.createdAt.toISOString().replace('T', ' ').slice(0, 19)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{row.feature}</td>
                    <td className="px-3 py-2 font-mono text-xs">{row.model}</td>
                    <td className="px-3 py-2 text-xs text-rose-700">
                      {row.errorReason ?? '(no reason captured)'}
                    </td>
                    <td className="px-3 py-2 text-right">{row.durationMs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className="border-t border-slate-200 pt-4 text-xs text-slate-500">
        Source table: <code>LlmCallLog</code>. Logger installed in each
        app&apos;s <code>instrumentation.ts</code>. Add a feature tag at the call
        site via <code>{`callClaude({ ..., feature: 'my_feature' })`}</code>.
      </footer>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
