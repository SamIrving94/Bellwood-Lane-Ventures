'use client';

import {
  companyAccount,
  gmailComposeUrl,
  mailtoUrl,
} from '@/lib/deal-email-view';
import { useUser } from '@repo/auth/client';
import { Button } from '@repo/design-system/components/ui/button';

export type EmailRecipient = {
  /** "seller" | "solicitor": finishes "Email the …". */
  label: string;
  email: string;
};

/**
 * "Email the seller" / "Email the solicitor". Opens a compose window with the
 * recipient, this deal's own log address in CC, and the property as the
 * subject. The CC is the point: an email started here files itself on this
 * deal with no matching, and nobody has to remember the address.
 *
 * It only opens a draft. A person writes it and sends it.
 */
export function EmailButtons({
  recipients,
  cc,
  subject,
}: {
  recipients: EmailRecipient[];
  /** This deal's own log address (`log+<dealId>@…`). */
  cc: string;
  subject: string;
}) {
  // Which Google account should compose: the founder's company address, when
  // their sign-in has one. Null means Gmail picks, hence the reminder below.
  const { user } = useUser();
  const account = companyAccount(
    user?.emailAddresses.map((e) => e.emailAddress) ?? [],
    cc
  );

  if (recipients.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">
        No seller or solicitor email is saved on this deal, so there is no Email
        button yet.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-2">
        {recipients.map((r) => (
          <Button asChild key={r.label} size="sm">
            <a
              href={gmailComposeUrl({ to: r.email, cc, subject, account })}
              rel="noreferrer"
              target="_blank"
              title={`To ${r.email}, CC ${cc}`}
            >
              Email the {r.label}
            </a>
          </Button>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">
        Opens Gmail with this deal&rsquo;s address already in CC. Check the From
        address before you send. On a phone or another mail app:{' '}
        {recipients.map((r, i) => (
          <span key={r.label}>
            {i > 0 && ' · '}
            <a
              className="underline underline-offset-2"
              href={mailtoUrl({ to: r.email, cc, subject })}
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
