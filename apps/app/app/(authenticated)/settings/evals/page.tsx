import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Header } from '../../components/header';
import { EvalConfigCard } from './components/eval-config-card';
import { SeedButton } from './components/seed-button';

export const metadata: Metadata = {
  title: 'Eval Models — Bellwood Ventures',
  description: 'Configure agent scoring and evaluation parameters',
};

const EVAL_TYPES = [
  {
    type: 'lead_scoring' as const,
    label: 'Lead Scoring',
    description: 'Weights for motivation, equity, market trend, and contact quality scoring',
  },
  {
    type: 'deal_quality' as const,
    label: 'Deal Quality',
    description: 'Seller type margins, min margin threshold, preferred areas and seller types',
  },
  {
    type: 'avm_confidence' as const,
    label: 'AVM Confidence',
    description: 'Data source trust weights, appreciation rates, type discounts, max discounts',
  },
  {
    type: 'outreach_quality' as const,
    label: 'Outreach Quality',
    description: 'Tone guidelines by recipient type, follow-up schedules, max follow-ups',
  },
];

const EvalsPage = async () => {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  // Fetch active config for each eval type
  const configs = await database.evalConfig.findMany({
    where: { activatedAt: { not: null } },
    orderBy: { activatedAt: 'desc' },
  });

  // Also fetch version counts
  const versionCounts = await database.evalConfig.groupBy({
    by: ['evalType'],
    _count: { id: true },
    _max: { version: true },
  });

  const configMap = Object.fromEntries(configs.map((c) => [c.evalType, c]));
  const versionMap = Object.fromEntries(
    versionCounts.map((v) => [v.evalType, { count: v._count.id, latest: v._max.version }])
  );

  const hasAnyConfigs = configs.length > 0;

  return (
    <>
      <Header
        pages={[{ title: 'Settings', url: '/settings' }]}
        page="Eval Models"
      />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Eval Models</h1>
            <p className="text-sm text-muted-foreground">
              Configure the scoring parameters your agents use. Changes take effect on the next pipeline run.
            </p>
          </div>
          {!hasAnyConfigs && <SeedButton />}
        </div>

        {!hasAnyConfigs && (
          <div className="rounded-lg border bg-card p-8 text-center">
            <p className="text-muted-foreground">
              No eval configs yet. Click &quot;Seed Defaults&quot; to create version 1 of each eval model using the current hardcoded values.
            </p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {EVAL_TYPES.map((evalType) => {
            const active = configMap[evalType.type];
            const versions = versionMap[evalType.type];

            return (
              <EvalConfigCard
                key={evalType.type}
                evalType={evalType.type}
                label={evalType.label}
                description={evalType.description}
                activeVersion={active?.version ?? null}
                totalVersions={versions?.count ?? 0}
                config={active?.config as Record<string, unknown> | null ?? null}
                activatedAt={active?.activatedAt ?? null}
              />
            );
          })}
        </div>
      </div>
    </>
  );
};

export default EvalsPage;
