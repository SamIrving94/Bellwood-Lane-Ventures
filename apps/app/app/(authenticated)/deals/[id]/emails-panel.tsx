import type { EmailCardData } from '@/lib/deal-emails';
import Link from 'next/link';
import { CopyButton } from '../components/copy-button';
import { EmailCard } from '../components/email-card';

/** Emails shown before the rest fold away. */
const SHOWN_FIRST = 5;

/**
 * The deal's email log. Every email a founder copied the log address on,
 * and every reply to it, newest first. Written by the Postmark webhook in
 * apps/api; this panel only reads.
 */
export function EmailsPanel({
  emails,
  logAddress,
  dealAddress,
}: {
  /** Null when the log table is not there yet (run `pnpm migrate`). */
  emails: EmailCardData[] | null;
  /** The address to CC. Null when DEAL_LOG_ADDRESS is not set. */
  logAddress: string | null;
  /** This deal's own tagged address. Null when there is no log address. */
  dealAddress: string | null;
}) {
  const waiting = emails?.filter((e) => e.waitingOnUs).length ?? 0;
  const first = emails?.slice(0, SHOWN_FIRST) ?? [];
  const rest = emails?.slice(SHOWN_FIRST) ?? [];

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
          Emails
          {emails && emails.length > 0 && (
            <span className="ml-2 normal-case tracking-normal">
              {emails.length}
              {waiting > 0 && ` · ${waiting} waiting on us`}
            </span>
          )}
        </h2>
        <Link
          className="text-muted-foreground text-xs underline-offset-2 hover:underline"
          href="/deals/email-log"
        >
          All emails
        </Link>
      </div>

      {emails === null ? (
        <p className="mt-3 text-muted-foreground text-sm">
          The email log is not switched on yet. Run{' '}
          <code className="rounded bg-muted px-1">pnpm migrate</code> once to
          add its table.
        </p>
      ) : logAddress && dealAddress ? (
        <div className="mt-3 space-y-2 text-sm">
          <p>
            <strong>CC</strong>{' '}
            <code className="rounded bg-muted px-1">{logAddress}</code> on any
            email about this home. It lands here, and so does every reply.
          </p>
          <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
            <span>
              Not filing itself? Use this deal&rsquo;s own address:{' '}
              <code className="rounded bg-muted px-1">{dealAddress}</code>
            </span>
            <CopyButton value={dealAddress} />
          </div>
        </div>
      ) : (
        <p className="mt-3 text-muted-foreground text-sm">
          No log address is set. Add{' '}
          <code className="rounded bg-muted px-1">DEAL_LOG_ADDRESS</code> to the
          dashboard project in Vercel to show it here.
        </p>
      )}

      {emails && emails.length === 0 && (
        <p className="mt-3 text-muted-foreground text-sm">
          Nothing logged on this deal yet.
        </p>
      )}

      {first.length > 0 && (
        <ul className="mt-3 space-y-2">
          {first.map((e) => (
            <li key={e.id}>
              <EmailCard email={e} />
            </li>
          ))}
        </ul>
      )}

      {rest.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-muted-foreground text-sm">
            Show {rest.length} older email{rest.length === 1 ? '' : 's'}
          </summary>
          <ul className="mt-2 space-y-2">
            {rest.map((e) => (
              <li key={e.id}>
                <EmailCard email={e} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
