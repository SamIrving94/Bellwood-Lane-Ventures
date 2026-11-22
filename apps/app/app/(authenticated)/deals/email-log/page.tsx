import { fileDealEmail } from '@/app/actions/deals/file-email';
import { logAddress, toEmailCards } from '@/lib/deal-emails';
import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import { Button } from '@repo/design-system/components/ui/button';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Header } from '../../components/header';
import { CopyButton } from '../components/copy-button';
import { EmailCard } from '../components/email-card';

export const metadata: Metadata = {
  title: 'Email log — Kept',
};

export const dynamic = 'force-dynamic';

// The email log across every deal. Two jobs:
//   1. Place the emails the matcher would not guess a deal for.
//   2. Show the latest emails, with a way to move one filed on the wrong deal.
// Emails arrive through the Postmark webhook in apps/api; nothing here sends.

const CLOSED = ['completed', 'rejected', 'withdrawn'];

// Finishes the sentence "Here because …".
const MATCHED_BY: Record<string, string> = {
  deal_tag: 'it was sent to the deal’s own address',
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

export default async function EmailLogPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect('/sign-in');
  }

  const address = logAddress();

  // Null = the table is not there yet. The page explains instead of failing.
  const loaded = await Promise.all([
    database.dealEmail.findMany({
      where: { dealId: null },
      orderBy: { sentAt: 'desc' },
      take: 50,
    }),
    database.dealEmail.findMany({
      where: { dealId: { not: null } },
      orderBy: { sentAt: 'desc' },
      take: 40,
      include: { deal: { select: { address: true, postcode: true } } },
    }),
  ]).catch((_err) => {
    return null;
  });

  const deals = await database.deal.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 200,
    select: { id: true, address: true, postcode: true, status: true },
  });
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
              <strong>CC the log address</strong> on an email to a seller,
              solicitor or agent.
            </li>
            <li>
              The email is <strong>stored on the deal</strong>. So is every
              reply-all after it.
            </li>
            <li>
              If no single deal matches, it <strong>waits here</strong>. It is
              never guessed.
            </li>
          </ul>
          {address ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <code className="rounded bg-muted px-2 py-1">{address}</code>
              <CopyButton value={address} />
            </div>
          ) : (
            <p className="mt-3 text-muted-foreground text-sm">
              No log address is set. Add{' '}
              <code className="rounded bg-muted px-1">DEAL_LOG_ADDRESS</code> to
              the dashboard project in Vercel to show it here.
            </p>
          )}
        </div>

        {loaded === null && (
          <p className="max-w-3xl rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950">
            The email log is not switched on yet. Run{' '}
            <code className="rounded bg-muted px-1">pnpm migrate</code> once to
            add its table.
          </p>
        )}

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
                  <EmailCard bare email={e} />
                  <FileForm
                    deals={dealOptions}
                    emailId={e.id}
                    label="File on this deal"
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="max-w-3xl">
          <h2 className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
            Latest emails
          </h2>
          {filed.length === 0 ? (
            <p className="mt-2 text-muted-foreground text-sm">
              No email has arrived yet. If you have CC&rsquo;d the address and
              nothing shows here, the inbound setup is not finished: follow{' '}
              <code className="rounded bg-muted px-1">
                docs/setup/email-forward.md
              </code>
              .
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
                  <EmailCard bare email={e} />
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
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
