import type { EmailCardData } from '@/lib/deal-email-view';
import type { EmailLogState } from '@/lib/email-log-setup';
import Link from 'next/link';
import { EmailCard } from '../components/email-card';
import { SwitchOnEmailLog } from '../components/switch-on-email-log';
import { EmailButtons, type EmailRecipient } from './email-buttons';
import { FindOlderEmails } from './find-older-emails';

/** Emails shown before the rest fold away. */
const SHOWN_FIRST = 5;

// Deal contact fields are free text. Only offer a button for something that
// is plainly one email address.
const ONE_EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

/**
 * The deal's email log: every email with this deal's seller or solicitor,
 * and the conversations around them, newest first. Read from the Kept Gmail
 * mailbox by the google-sync cron (`importDealMail`); this panel only reads
 * the result.
 */
export function EmailsPanel({
  dealId,
  emails,
  google,
  logState,
  sellerEmail,
  solicitorEmail,
  subject,
}: {
  dealId: string;
  /** Null when the log table is not there yet: the panel offers to add it. */
  emails: EmailCardData[] | null;
  /** The Google connection the log reads through. */
  google: {
    connected: boolean;
    broken: boolean;
    email: string | null;
    /** Every mailbox the log reads, main account first. */
    mailboxes: string[];
  };
  /** Why `emails` is null: the table is missing, older than the code, or fine. */
  logState: EmailLogState;
  sellerEmail: string | null;
  solicitorEmail: string | null;
  /** Subject for an email started here: the property. */
  subject: string;
}) {
  const recipients: EmailRecipient[] = [
    { label: 'seller', email: sellerEmail?.trim() ?? '' },
    { label: 'solicitor', email: solicitorEmail?.trim() ?? '' },
  ].filter((r) => ONE_EMAIL.test(r.email));
  const gmailAccount = google.connected ? google.email : null;

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
        <div className="mt-3">
          {logState === 'current' ? (
            <p className="text-muted-foreground text-sm">
              The email log could not be read just now. Try again shortly.
            </p>
          ) : (
            <SwitchOnEmailLog state={logState} />
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-2 text-sm">
          <EmailButtons
            gmailAccount={gmailAccount}
            recipients={recipients}
            subject={subject}
          />
          {google.connected ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <p className="min-w-0 flex-1">
                Kept reads <strong>{google.mailboxes.join(', ')}</strong> every
                30 minutes. Emails with this deal&rsquo;s seller or solicitor
                land here on their own. For anything else, put the{' '}
                <strong>Kept/Log</strong> label on it in Gmail.
              </p>
              <FindOlderEmails dealId={dealId} />
            </div>
          ) : (
            <p className="rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
              {google.broken
                ? 'Google needs reconnecting, so no new emails are being read. '
                : 'Emails are read from Gmail, and Google is not connected yet. '}
              <Link className="underline" href="/settings/google">
                Open Settings → Google
              </Link>
              .
            </p>
          )}
        </div>
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
              <EmailCard email={e} gmailAccount={gmailAccount} />
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
                <EmailCard email={e} gmailAccount={gmailAccount} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
