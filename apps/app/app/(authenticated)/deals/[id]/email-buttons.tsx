import { gmailComposeUrl, mailtoUrl } from '@/lib/deal-email-view';
import { Button } from '@repo/design-system/components/ui/button';

export type EmailRecipient = {
  /** "seller" | "solicitor": finishes "Email the …". */
  label: string;
  email: string;
};

/**
 * "Email the seller" / "Email the solicitor". Opens a Gmail draft, in the
 * Kept account, with the recipient and the property as the subject. Nothing
 * to copy in: the email log reads the mailbox, so the email is picked up
 * once it is sent.
 *
 * It only opens a draft. A person writes it and sends it.
 */
export function EmailButtons({
  recipients,
  subject,
  gmailAccount,
}: {
  recipients: EmailRecipient[];
  subject: string;
  /** The connected Kept mailbox. Null when Google is not connected. */
  gmailAccount: string | null;
}) {
  if (recipients.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">
        No seller or solicitor email is saved on this deal. Add one and their
        emails are picked up from Gmail.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-2">
        {recipients.map((r) => (
          <Button asChild key={r.label} size="sm">
            <a
              href={gmailComposeUrl({
                to: r.email,
                subject,
                account: gmailAccount,
              })}
              rel="noreferrer"
              target="_blank"
              title={`To ${r.email}`}
            >
              Email the {r.label}
            </a>
          </Button>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">
        Opens a Gmail draft
        {gmailAccount ? ` in ${gmailAccount}` : ''}. On a phone or another mail
        app:{' '}
        {recipients.map((r, i) => (
          <span key={r.label}>
            {i > 0 && ' · '}
            <a
              className="underline underline-offset-2"
              href={mailtoUrl({ to: r.email, subject })}
            >
              {r.label}
            </a>
          </span>
        ))}
        .
      </p>
    </div>
  );
}
