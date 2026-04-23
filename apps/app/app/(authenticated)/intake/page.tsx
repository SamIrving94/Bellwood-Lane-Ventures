import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import { formatDistanceToNow } from 'date-fns';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Header } from '../components/header';
import { PasteForm } from './paste-form';

export const metadata: Metadata = {
  title: 'WhatsApp Intake — Bellwood Ventures',
  description:
    'Receive and parse property leads shared in WhatsApp groups.',
};

const sourceBadge: Record<string, { label: string; cls: string }> = {
  bridge: {
    label: 'Bridge',
    cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  },
  paste: {
    label: 'Paste',
    cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  },
  share_sheet: {
    label: 'Shared',
    cls: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400',
  },
  email: {
    label: 'Email',
    cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  },
};

const statusBadge: Record<string, { label: string; cls: string }> = {
  pending: {
    label: 'Pending',
    cls: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  },
  parsed: {
    label: 'Parsed',
    cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  },
  failed: {
    label: 'Failed',
    cls: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
  },
  manual_review: {
    label: 'Manual review',
    cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  },
};

const IntakePage = async () => {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const intakes = await database.whatsAppIntake.findMany({
    orderBy: { receivedAt: 'desc' },
    take: 20,
  });

  // Bridge status: placeholder — when we build a heartbeat, read here.
  const bridgeConnected = false;

  return (
    <>
      <Header pages={[]} page="WhatsApp Intake" />
      <div className="flex flex-1 flex-col gap-6 p-6">
        {/* Bridge status */}
        <div
          className={`rounded-lg border p-4 ${
            bridgeConnected
              ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950'
              : 'border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950'
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                bridgeConnected
                  ? 'bg-emerald-500'
                  : 'bg-red-500'
              }`}
            />
            <div>
              <p className="font-medium text-sm">
                {bridgeConnected
                  ? 'WhatsApp bridge connected'
                  : 'Bridge not connected'}
              </p>
              <p className="text-xs text-muted-foreground">
                {bridgeConnected
                  ? 'Messages from allowed groups auto-ingest.'
                  : 'Not connected yet — run the bridge service to enable auto-ingest. See services/whatsapp-bridge/README.md.'}
              </p>
            </div>
          </div>
        </div>

        {/* Paste form */}
        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-1 font-semibold text-lg">Paste a message</h2>
          <p className="mb-4 text-muted-foreground text-sm">
            Paste a WhatsApp message here to parse it into a ScoutLead. Useful
            before the bridge is running, or for one-off leads.
          </p>
          <PasteForm />
        </div>

        {/* Recent intake */}
        <div className="rounded-lg border bg-card">
          <div className="border-b p-4">
            <h2 className="font-semibold text-lg">Recent intake</h2>
            <p className="text-muted-foreground text-sm">
              Last 20 messages received.
            </p>
          </div>

          {intakes.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No intake yet. Paste a message above or start the bridge.
            </div>
          ) : (
            <ul className="divide-y">
              {intakes.map((i) => {
                const src = sourceBadge[i.source] ?? sourceBadge.paste;
                const st = statusBadge[i.parseStatus] ?? statusBadge.pending;
                return (
                  <li key={i.id} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                          <span
                            className={`rounded-full px-2 py-0.5 font-medium ${src.cls}`}
                          >
                            {src.label}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 font-medium ${st.cls}`}
                          >
                            {st.label}
                          </span>
                          {i.groupName && (
                            <span className="text-muted-foreground">
                              {i.groupName}
                            </span>
                          )}
                          {i.senderName && (
                            <span className="text-muted-foreground">
                              from {i.senderName}
                            </span>
                          )}
                          <span className="text-muted-foreground">
                            {formatDistanceToNow(new Date(i.receivedAt), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                        <p className="truncate text-sm">
                          {i.rawText.slice(0, 100)}
                          {i.rawText.length > 100 ? '...' : ''}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-3 text-xs">
                          {i.scoutLeadId && (
                            <Link
                              href={`/leads?lead=${i.scoutLeadId}`}
                              className="text-primary underline underline-offset-2"
                            >
                              View lead
                            </Link>
                          )}
                          {i.founderActionId && (
                            <Link
                              href="/actions"
                              className="text-primary underline underline-offset-2"
                            >
                              Review action
                            </Link>
                          )}
                          {typeof i.parsedConfidence === 'number' && (
                            <span className="text-muted-foreground">
                              confidence {i.parsedConfidence.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  );
};

export default IntakePage;
