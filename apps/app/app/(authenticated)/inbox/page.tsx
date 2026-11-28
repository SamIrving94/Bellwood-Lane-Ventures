import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import { isDeliveryProblem } from '@repo/email/delivery';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Header } from '../components/header';

export const metadata: Metadata = {
  title: 'Inbox — Kept',
  description:
    'Every email we sent and every reply, one conversation per person',
};

/** How far back the list looks. Plenty for a two-founder desk; raise if it bites. */
const RECENT_MESSAGES = 1000;

const when = (d: Date) =>
  d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

type Thread = {
  counterparty: string;
  latest: {
    direction: 'inbound' | 'outbound';
    subject: string;
    textBody: string | null;
    createdAt: Date;
    dealId: string | null;
    quoteRequestId: string | null;
  };
  total: number;
  unread: number;
  hasInbound: boolean;
  /** An email to this person bounced, failed or was marked as spam. */
  undelivered: boolean;
};

const ThreadRow = ({ thread: t }: { thread: Thread }) => (
  <Link
    className="flex items-start justify-between gap-4 rounded-lg border bg-card p-4 hover:bg-accent"
    href={`/inbox/${encodeURIComponent(t.counterparty)}`}
  >
    <div className="min-w-0 space-y-1">
      <p className={t.unread > 0 ? 'font-bold text-sm' : 'font-medium text-sm'}>
        {t.counterparty}
        {t.unread > 0 && (
          <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-primary-foreground text-xs">
            {t.unread} new
          </span>
        )}
      </p>
      <p className="truncate text-sm">
        {t.latest.direction === 'inbound' ? 'They wrote: ' : 'We sent: '}
        {t.latest.subject}
      </p>
      <p className="line-clamp-1 text-muted-foreground text-xs">
        {(t.latest.textBody ?? '').slice(0, 160)}
      </p>
    </div>
    <div className="shrink-0 text-right text-muted-foreground text-xs">
      <p>{when(t.latest.createdAt)}</p>
      <p>
        {t.total} email{t.total === 1 ? '' : 's'}
      </p>
      {(t.latest.dealId || t.latest.quoteRequestId) && <p>Linked</p>}
      {t.undelivered && (
        <p className="font-medium text-destructive">Not delivered</p>
      )}
    </div>
  </Link>
);

const InboxPage = async () => {
  const { userId } = await auth();
  if (!userId) {
    redirect('/sign-in');
  }

  const messages = await database.emailMessage.findMany({
    orderBy: { createdAt: 'desc' },
    take: RECENT_MESSAGES,
    select: {
      counterparty: true,
      direction: true,
      subject: true,
      textBody: true,
      readAt: true,
      deliveryStatus: true,
      createdAt: true,
      dealId: true,
      quoteRequestId: true,
    },
  });

  // One row per person: their newest message (rows arrive newest first),
  // plus counts.
  const threads = new Map<string, Thread>();
  for (const m of messages) {
    const t = threads.get(m.counterparty) ?? {
      counterparty: m.counterparty,
      latest: m,
      total: 0,
      unread: 0,
      hasInbound: false,
      undelivered: false,
    };
    t.total += 1;
    if (m.deliveryStatus && isDeliveryProblem(m.deliveryStatus)) {
      t.undelivered = true;
    }
    if (m.direction === 'inbound') {
      t.hasInbound = true;
      if (!m.readAt) {
        t.unread += 1;
      }
    }
    threads.set(m.counterparty, t);
  }

  const all = [...threads.values()];
  const replied = all.filter((t) => t.hasInbound);
  const sentOnly = all.filter((t) => !t.hasInbound);
  const unreadTotal = all.reduce((n, t) => n + t.unread, 0);

  return (
    <>
      <Header page="Inbox" pages={[]} />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <div>
          <h1 className="font-bold text-xl">Inbox</h1>
          <p className="text-muted-foreground text-sm">
            Every email we sent and every reply. One conversation per person.
            {unreadTotal > 0 ? ` ${unreadTotal} unread.` : ''}
          </p>
        </div>

        {all.length === 0 && (
          <div className="rounded-lg border bg-card p-8 text-center">
            <p className="text-muted-foreground">
              Nothing here yet. Emails appear as soon as the app sends one.
              Replies appear once inbound mail is connected.
            </p>
          </div>
        )}

        {replied.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
              Conversations ({replied.length})
            </h2>
            {replied.map((t) => (
              <ThreadRow key={t.counterparty} thread={t} />
            ))}
          </div>
        )}

        {sentOnly.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
              Sent, no reply yet ({sentOnly.length})
            </h2>
            {sentOnly.map((t) => (
              <ThreadRow key={t.counterparty} thread={t} />
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default InboxPage;
