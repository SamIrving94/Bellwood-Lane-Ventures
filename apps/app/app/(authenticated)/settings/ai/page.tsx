import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Header } from '../../components/header';
import { getRoutingTable } from '../../../actions/ai-routing/update';
import { RoutingTable } from './routing-table';

export const metadata: Metadata = {
  title: 'AI models — Bellwood Ventures',
  description: 'Per-feature model routing and shadow evals',
};

export const dynamic = 'force-dynamic';

const AiSettingsPage = async () => {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [featureCounts, routes] = await Promise.all([
    database.llmCallLog.groupBy({
      by: ['feature'],
      where: { createdAt: { gte: since } },
      _count: { feature: true },
    }),
    getRoutingTable(),
  ]);

  // One row per real feature — internal suffixes are derived views.
  const counts = new Map<string, number>();
  for (const f of featureCounts) {
    const base = f.feature
      .replace(/__shadow$/, '')
      .replace(/_via_fallback$/, '');
    counts.set(base, (counts.get(base) ?? 0) + f._count.feature);
  }
  for (const feature of Object.keys(routes)) {
    if (!counts.has(feature)) counts.set(feature, 0);
  }

  const rows = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([feature, callsLast30d]) => ({
      feature,
      callsLast30d,
      codeDefault: null,
      route: routes[feature] ?? {},
    }));

  return (
    <>
      <Header
        pages={[{ title: 'Settings', url: '/settings' }]}
        page="AI models"
      />
      <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">AI models</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground text-sm">
            Choose which model runs each AI feature. <b>Blank = the code
            default (Claude)</b>. A model id with a slash (e.g.{' '}
            <span className="font-mono">moonshotai/kimi-k2.6</span>) routes via
            OpenRouter. Set a <b>shadow model</b> to silently run the same
            prompts on a challenger — compare cost and quality on the{' '}
            <a href="/admin/llm-usage" className="text-primary underline">
              LLM usage
            </a>{' '}
            page before switching. Tick <b>PII-safe pinning</b> for any feature
            that sees vendor names or addresses.
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground text-sm">
            No AI calls logged yet. Features appear here after the first
            cron cycle runs with API keys set.
          </div>
        ) : (
          <RoutingTable initialRows={rows} />
        )}
      </div>
    </>
  );
};

export default AiSettingsPage;
