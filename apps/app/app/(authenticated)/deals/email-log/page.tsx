import { fileDealEmail } from '@/app/actions/deals/file-email';
import { removeDealEmail } from '@/app/actions/deals/remove-email';
import { syncHealth, toEmailCards } from '@/lib/deal-email-view';
import { getEmailLogState } from '@/lib/email-log-db';
import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import { Button } from '@repo/design-system/components/ui/button';
import { getDealMailStatus, getGoogleStatus } from '@repo/google';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Header } from '../../components/header';
import { EmailCard } from '../components/email-card';
import { SwitchOnEmailLog } from '../components/switch-on-email-log';

export const metadata: Metadata = {
  title: 'Email log — Kept',
};

export const dynamic = 'force-dynamic';

// The email log across every deal. Three jobs:
//   1. Say whether the Gmail sync is alive, because "nothing here" means
//      nothing unless it is.
//   2. Place the emails the importer would not guess a deal for.
//   3. Show the latest emails, with a way to move or remove one.
// Emails are read from Gmail by the google-sync cron; nothing here sends.

const CLOSED = ['completed', 'rejected', 'withdrawn'];

const WHEN = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/London',
});

// Finishes the sentence "Here because …".
const MATCHED_BY: Record<string, string> = {
  thread: 'it is a reply in a conversation on this deal',
  participant: 'the seller or solicitor is on this deal',
  postcode: 'of the postcode in the email',
  manual: 'it was filed by hand',
};

type DealOption = { id: string; address: string; postcode: string };

/** Deal picker + button. A plain form, so it works with no client code. */
function FileForm({
  emailId,
  deals,
  label,
}: {
  emailId: string;
  deals: DealOption[];
  label: string;
}) {
  return (
    <form
      action={fileDealEmail}
      className="mt-3 flex flex-wrap items-center gap-2"
    >
      <input name="emailId" type="hidden" value={emailId} />
      <select
        aria-label="Deal"
        className="min-w-0 max-w-full flex-1 rounded border bg-background px-3 py-2 text-sm"
        defaultValue=""
        name="dealId"
        required
      >
        <option disabled value="">
          Pick the deal…
        </option>
        {deals.map((d) => (
          <option key={d.id} value={d.id}>
            {d.address}, {d.postcode}
          </option>
        ))}
      </select>
      <Button size="sm" type="submit">
        {label}
      </Button>
    </form>
  );
}

/**
 * Take an email out of the log. Tucked inside a <details> so it takes two
 * deliberate clicks: it wipes our copy and cannot be undone.
 */
function RemoveForm({ emailId }: { emailId: string }) {
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-muted-foreground text-xs">
        Not deal mail?
      </summary>
      <form
        action={removeDealEmail}
        className="mt-2 flex flex-wrap items-center gap-2"
      >
        <input name="emailId" type="hidden" value={emailId} />
        <Button size="sm" type="submit" variant="outline">
          Remove this email
        </Button>
        <span className="text-muted-foreground text-xs">
          Removes it from Kept and it is not read again. It stays in Gmail. This
          cannot be undone.
        </span>
      </form>
    </details>
  );
}

export default async function EmailLogPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect('/sign-in');
  }

  // Null = the table is not there yet. The page explains instead of failing.
  const loaded = await Promise.all([
    database.dealEmail.findMany({
      where: { dealId: null, removedAt: null },
      orderBy: { sentAt: 'desc' },
      take: 50,
    }),
    database.dealEmail.findMany({
      where: { dealId: { not: null }, removedAt: null },
      orderBy: { sentAt: 'desc' },
      take: 40,
      include: { deal: { select: { address: true, postcode: true } } },
    }),
  ]).catch((err) => {
    console.warn('[email-log] email log unavailable', err);
    return null;
  });

  const [google, sync, deals] = await Promise.all([
    getGoogleStatus(),
    getDealMailStatus(),
    database.deal.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 200,
      select: { id: true, address: true, postcode: true, status: true },
    }),
  ]);
  const health = syncHealth(sync.lastRunAt);
  // While the table is missing nothing is read or stored, so the page says
  // only that: no "last checked", no "nothing waiting".
  const on = loaded !== null;
  const logState = on ? 'current' : await getEmailLogState();
  const gmailAccount = google.connected ? google.email : null;

  // Live deals first: that is where a new email almost always belongs.
  const dealOptions: DealOption[] = [
    ...deals.filter((d) => !CLOSED.includes(d.status)),
    ...deals.filter((d) => CLOSED.includes(d.status)),
  ];

  const unfiled = loaded ? toEmailCards(loaded[0]) : [];
  const filedRows = loaded ? loaded[1] : [];
  const filed = toEmailCards(filedRows);
  const dealLabel = new Map(
    filedRows.map((r) => [
      r.id,
      r.deal ? `${r.deal.address}, ${r.deal.postcode}` : 'a deal',
    ])
  );

  return (
    <>
      <Header pages={[]} page="Email log" />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="max-w-3xl">
          <h1 className="font-bold text-xl">Email log</h1>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            <li>
              <strong>Kept reads your Gmail</strong> every 30 minutes. You do
              nothing.
            </li>
            <li>
              Emails with a deal&rsquo;s <strong>seller or solicitor</strong>{' '}
              are stored on that deal. So are the replies.
            </li>
            <li>
              For anything else, put the <strong>Kept/Log</strong> label on it
              in Gmail.
            </li>
            <li>
              If no single deal matches, it <strong>waits here</strong>. It is
              never guessed.
            </li>
          </ul>

          {on && google.connected && health === 'ok' && sync.lastRun && (
            <p className="mt-3 text-muted-foreground text-sm">
              <strong>Reading {google.mailboxes.join(', ')}.</strong> Last
              checked {WHEN.format(new Date(sync.lastRun.at))}:{' '}
              {sync.lastRun.scanned} new,{' '}
              {sync.lastRun.kept + sync.lastRun.unfiled} kept.
              {sync.lastRun.errors > 0 &&
                ` ${sync.lastRun.errors} could not be read and will be tried again.`}
            </p>
          )}
          {on && google.connected && health === 'never' && (
            <p className="mt-3 text-muted-foreground text-sm">
              <strong>Connected to {google.email}.</strong> The first check runs
              within 30 minutes.
            </p>
          )}
        </div>

        {!google.connected && (
          <div className="max-w-3xl rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950">
            <p className="font-medium">
              {google.broken
                ? 'Google needs reconnecting.'
                : 'Google is not connected.'}
            </p>
            <p className="mt-1">
              Emails are read from Gmail, so nothing new is stored until it is.{' '}
              <Link className="underline" href="/settings/google">
                Open Settings → Google
              </Link>
              .
            </p>
          </div>
        )}

        {on && google.connected && health === 'stale' && sync.lastRunAt && (
          <div className="max-w-3xl rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950">
            <p className="font-medium">Gmail has not been checked lately.</p>
            <p className="mt-1">
              The last check was {WHEN.format(new Date(sync.lastRunAt))}. It
              should run every 30 minutes, so the sync job has stopped. Emails
              since then are not here yet; they will be picked up when it runs
              again.
            </p>
          </div>
        )}

        {!on && (
          <div className="max-w-3xl rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
            {logState === 'current' ? (
              <p className="text-sm">
                The email log could not be read just now. Try again shortly.
              </p>
            ) : (
              <SwitchOnEmailLog state={logState} />
            )}
          </div>
        )}

        {on && (
          <section className="max-w-3xl">
            <h2 className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
              Needs a deal
              <span className="ml-2 normal-case tracking-normal">
                {unfiled.length}
              </span>
            </h2>
            {unfiled.length === 0 ? (
              <p className="mt-2 text-muted-foreground text-sm">
                Nothing waiting. Every email found its deal.
              </p>
            ) : (
              <ul className="mt-2 space-y-3">
                {unfiled.map((e) => (
                  <li className="rounded-lg border bg-card p-3" key={e.id}>
                    <EmailCard bare email={e} gmailAccount={gmailAccount} />
                    <FileForm
                      deals={dealOptions}
                      emailId={e.id}
                      label="File on this deal"
                    />
                    <RemoveForm emailId={e.id} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {on && (
          <section className="max-w-3xl">
            <h2 className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
              Latest emails
            </h2>
            {filed.length === 0 ? (
              <p className="mt-2 text-muted-foreground text-sm">
                No emails stored yet. They appear once Google is connected and a
                deal has its seller&rsquo;s or solicitor&rsquo;s email on it.
              </p>
            ) : (
              <ul className="mt-2 space-y-3">
                {filed.map((e) => (
                  <li className="rounded-lg border bg-card p-3" key={e.id}>
                    <p className="mb-2 text-xs">
                      <Link
                        className="font-medium underline-offset-2 hover:underline"
                        href={`/deals/${e.dealId}`}
                      >
                        {dealLabel.get(e.id)}
                      </Link>
                      {e.matchedBy && MATCHED_BY[e.matchedBy] && (
                        <span className="text-muted-foreground">
                          {' '}
                          · Here because {MATCHED_BY[e.matchedBy]}
                        </span>
                      )}
                    </p>
                    <EmailCard bare email={e} gmailAccount={gmailAccount} />
                    <details className="mt-2">
                      <summary className="cursor-pointer text-muted-foreground text-xs">
                        Wrong deal?
                      </summary>
                      <p className="mt-2 text-muted-foreground text-xs">
                        Moving it moves the whole conversation.
                      </p>
                      <FileForm
                        deals={dealOptions}
                        emailId={e.id}
                        label="Move to this deal"
                      />
                    </details>
                    <RemoveForm emailId={e.id} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </>
  );
}
