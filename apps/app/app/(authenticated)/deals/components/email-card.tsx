import { type EmailCardData, gmailThreadUrl } from '@/lib/deal-email-view';

const WHEN = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/London',
});

const DIRECTION_LABEL: Record<string, string> = {
  inbound: 'From them',
  outbound: 'From us',
};

const PARTY_LABEL: Record<string, string> = {
  vendor: 'Seller',
  solicitor: 'Solicitor',
  agent: 'Agent',
  investor: 'Investor',
};

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** First lines of an email, for when there is no summary to show. */
function opening(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > 240 ? `${flat.slice(0, 240)}…` : flat;
}

/**
 * One logged email. Summary first, the full text one click away: the point
 * is to know where a conversation stands without reading all of it.
 *
 * Attachments are listed by name only. The files stay in Gmail, so the way
 * to one is "Open in Gmail".
 */
export function EmailCard({
  email,
  gmailAccount,
  bare = false,
}: {
  email: EmailCardData;
  /**
   * The main Kept mailbox. "Open in Gmail" uses the email's own mailbox
   * when it has one, so Gmail opens in the account that holds it.
   */
  gmailAccount: string | null;
  /** No border or padding: the caller already drew a card around it. */
  bare?: boolean;
}) {
  const fromUs = email.direction === 'outbound';
  const newPart = email.replyText ?? email.bodyText;
  const hasHistory =
    email.replyText !== null && email.replyText !== email.bodyText;

  return (
    <div className={bare ? '' : 'rounded-md border bg-background p-3'}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span
          className={`rounded-full px-2 py-0.5 font-medium ${
            fromUs
              ? 'bg-muted text-muted-foreground'
              : 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-300'
          }`}
        >
          {DIRECTION_LABEL[email.direction] ?? email.direction}
        </span>
        {email.party && PARTY_LABEL[email.party] && !fromUs && (
          <span className="rounded-full border px-2 py-0.5">
            {PARTY_LABEL[email.party]}
          </span>
        )}
        {email.waitingOnUs && (
          <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
            Waiting on us
          </span>
        )}
        <span className="font-medium text-foreground">
          {email.fromName ?? email.fromEmail}
        </span>
        <span className="text-muted-foreground">
          {WHEN.format(new Date(email.sentAt))}
        </span>
      </div>

      <p className="mt-2 font-medium text-sm">
        {email.subject || '(no subject)'}
      </p>

      <p className="mt-1 text-sm">{email.summary ?? opening(newPart)}</p>

      {email.nextStep && (
        <p className="mt-1 text-sm">
          <span className="font-medium">Next:</span> {email.nextStep}
        </p>
      )}

      {email.attachments.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2 text-xs">
          {email.attachments.map((a) => (
            <li
              className="rounded border px-2 py-1"
              key={`${a.filename}-${a.sizeBytes}`}
            >
              {a.filename} ({formatSize(a.sizeBytes)})
            </li>
          ))}
        </ul>
      )}

      <p className="mt-2 text-xs">
        <a
          className="text-muted-foreground underline underline-offset-2"
          href={gmailThreadUrl(
            email.gmailThreadId,
            email.mailbox ?? gmailAccount
          )}
          rel="noreferrer"
          target="_blank"
        >
          Open in Gmail
          {email.attachments.length > 0 ? ' for the attachments' : ''}
        </a>
      </p>

      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-muted-foreground text-xs">
          Read the email
        </summary>
        <p className="mt-2 text-muted-foreground text-xs">
          To: {email.toEmails.join(', ') || '(none)'}
          {email.ccEmails.length > 0 && ` · Cc: ${email.ccEmails.join(', ')}`}
        </p>
        <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-sm">
          {newPart}
        </pre>
        {hasHistory && (
          <details className="mt-2">
            <summary className="cursor-pointer text-muted-foreground text-xs">
              With the earlier emails quoted below it
            </summary>
            <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-muted-foreground text-sm">
              {email.bodyText}
            </pre>
          </details>
        )}
      </details>
    </div>
  );
}
