import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import {
  DEFAULT_SCORER_CONFIG,
  mergeScorerConfig,
} from '@repo/scouting/src/scorer-config';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Header } from '../../components/header';
import { ConfigEditor } from './config-editor';
import { VersionHistory } from './version-history';

export const metadata: Metadata = {
  title: 'Tune the lead scorer — Bellwood Ventures',
  description: 'Adjust the weights the scorer uses, review, and activate.',
};

export const dynamic = 'force-dynamic';

const ScorerConfigPage = async () => {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const versions = await database.evalConfig.findMany({
    where: { evalType: 'lead_scoring' },
    orderBy: { version: 'desc' },
    take: 20,
    select: {
      version: true,
      description: true,
      activatedAt: true,
      activatedBy: true,
      createdAt: true,
    },
  });

  // The live config = highest active version, merged over defaults.
  const active = await database.evalConfig.findFirst({
    where: { evalType: 'lead_scoring', activatedAt: { not: null } },
    orderBy: { version: 'desc' },
    select: { version: true, config: true },
  });

  const liveConfig = active
    ? mergeScorerConfig(active.config)
    : DEFAULT_SCORER_CONFIG;
  const liveVersion = active?.version ?? null;

  return (
    <>
      <Header
        pages={[
          { title: 'Leads', url: '/leads' },
          { title: 'Calibration', url: '/leads/calibration' },
        ]}
        page="Tune scorer"
      />
      <main className="mx-auto w-full max-w-3xl space-y-6 p-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Leads · Tune scorer
          </p>
          <h1 className="mt-1 font-semibold text-2xl tracking-tight">
            Tune the lead scorer
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground text-sm">
            Adjust how the scorer weighs each lead. Changes apply to the{' '}
            <span className="font-medium text-foreground">next daily scout</span>
            , not to leads already scored. Every save creates a new version you
            can roll back to in one click — so it&apos;s safe to experiment.
          </p>
          <p className="mt-2 text-xs">
            Live now:{' '}
            {liveVersion ? (
              <span className="font-mono font-semibold text-emerald-700">
                v{liveVersion}
              </span>
            ) : (
              <span className="font-mono font-semibold text-slate-600">
                built-in defaults
              </span>
            )}{' '}
            ·{' '}
            <Link
              href="/leads/calibration"
              className="text-muted-foreground hover:text-foreground hover:underline"
            >
              See calibration data →
            </Link>
          </p>
        </div>

        <ConfigEditor
          live={liveConfig}
          defaults={DEFAULT_SCORER_CONFIG}
          liveVersion={liveVersion}
        />

        <VersionHistory versions={versions} liveVersion={liveVersion} />
      </main>
    </>
  );
};

export default ScorerConfigPage;
