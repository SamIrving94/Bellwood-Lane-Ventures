import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import {
  DEFAULT_OFFER_CONFIG,
  mergeOfferConfig,
} from '@repo/valuation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Header } from '../../components/header';
import { OfferConfigEditor } from './offer-config-editor';
import { OfferVersionHistory } from './offer-version-history';

export const metadata: Metadata = {
  title: 'Tune the offer policy — Bellwood Ventures',
  description: 'Adjust the acquisition margins and guard rails the AVM uses.',
};

export const dynamic = 'force-dynamic';

const OfferConfigPage = async () => {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const versions = await database.evalConfig.findMany({
    where: { evalType: 'avm_confidence' },
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

  const active = await database.evalConfig.findFirst({
    where: { evalType: 'avm_confidence', activatedAt: { not: null } },
    orderBy: { version: 'desc' },
    select: { version: true, config: true },
  });

  const liveConfig = active
    ? mergeOfferConfig(active.config)
    : DEFAULT_OFFER_CONFIG;
  const liveVersion = active?.version ?? null;

  return (
    <>
      <Header
        pages={[{ title: 'Pipeline', url: '/pipeline' }]}
        page="Tune offer policy"
      />
      <main className="mx-auto w-full max-w-3xl space-y-6 p-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Deals · Offer policy
          </p>
          <h1 className="mt-1 font-semibold text-2xl tracking-tight">
            Tune the offer policy
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground text-sm">
            Set how far below market value we buy, per seller type, plus the
            guard rails. Changes apply to{' '}
            <span className="font-medium text-foreground">
              the next valuation you run
            </span>{' '}
            — not to offers already made. Every save creates a new version you
            can roll back to in one click, so it&apos;s safe to experiment.
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
              href="/pipeline"
              className="text-muted-foreground hover:text-foreground hover:underline"
            >
              Back to pipeline →
            </Link>
          </p>
        </div>

        <OfferConfigEditor
          live={liveConfig}
          defaults={DEFAULT_OFFER_CONFIG}
          liveVersion={liveVersion}
        />

        <OfferVersionHistory versions={versions} liveVersion={liveVersion} />
      </main>
    </>
  );
};

export default OfferConfigPage;
