import { auth } from '@repo/auth/server';
import { Button } from '@repo/design-system/components/ui/button';
import {
  getGoogleStatus,
  getPartnerSheetUrl,
  googleRedirectUri,
  listExtraMailboxes,
} from '@repo/google';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  disconnectGoogleAccount,
  removeGoogleMailbox,
} from '../../../actions/google';
import { Header } from '../../components/header';
import { PartnerSheetButton } from './partner-sheet-button';

export const metadata: Metadata = {
  title: 'Google — Kept',
  description: 'Connect the Kept Google account',
};

export const dynamic = 'force-dynamic';

const ERRORS: Record<string, string> = {
  not_configured:
    'The Google keys are not in Vercel yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, redeploy, then try again.',
  state: 'That sign-in link had expired. Press Connect again.',
  cancelled: 'You cancelled on the Google screen. Nothing was connected.',
  exchange_failed:
    'Google refused the sign-in. Check the redirect link below matches the one in Google Cloud exactly.',
  no_refresh_token:
    'Google did not give long-lived access. Press Connect again.',
  no_email: 'Google did not say which account that was. Press Connect again.',
  personal_account:
    'That was a personal Gmail account. Sign in with the Kept account instead. Nothing was connected.',
  no_main:
    'Connect the main Kept account first. Then you can add more mailboxes.',
  is_main:
    'That is the main account. It is already read, so nothing was added.',
  other_domain:
    'That account is not on the Kept domain. Only Kept mailboxes can be added. Nothing was added.',
};

const WHAT_IT_DOES = [
  [
    'Gmail drafts',
    'Reviewed emails can go to your Gmail drafts. You press send.',
  ],
  [
    'Calendar',
    'Booked viewings appear in your calendar, with an "Offer due" marker two working days later.',
  ],
  [
    'Drive',
    'Each deal gets a folder at valuation: Photos, Legal, Offer, Comps.',
  ],
  [
    'Email log',
    'Emails with a deal’s seller or solicitor are stored on that deal. Read from every connected mailbox.',
  ],
  [
    'Labels',
    'Mail from sellers, solicitors and agents on your deals is labelled. Solicitor mail is starred.',
  ],
  [
    'Morning brief',
    'One short email each morning: viewings, offers due, emails to review.',
  ],
  [
    'Partner sheet',
    'A pipeline Sheet with no addresses, names or prices. Private until you share it.',
  ],
] as const;

const GoogleSettingsPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; connected?: string; added?: string }>;
}) => {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const [
    { error, connected, added },
    status,
    extras,
    sheetUrl,
    requestHeaders,
  ] = await Promise.all([
    searchParams,
    getGoogleStatus(),
    listExtraMailboxes(),
    getPartnerSheetUrl(),
    headers(),
  ]);

  // Built from the address this page was opened on, because that is the
  // address the Connect button will send Google back to.
  const host =
    requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host');
  const proto = requestHeaders.get('x-forwarded-proto') ?? 'https';
  const redirectUri = googleRedirectUri(`${proto}://${host}`);

  return (
    <>
      <Header pages={[{ title: 'Settings', url: '/settings' }]} page="Google" />
      <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">Google</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground text-sm">
            The main Kept account, plus any other Kept mailboxes you want in the
            email log. Nothing is ever sent to a seller from here: emails only
            reach your drafts.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900 text-sm dark:bg-red-950 dark:text-red-200">
            {ERRORS[error] ?? 'Something went wrong. Press Connect again.'}
          </div>
        )}
        {connected && status.connected && (
          <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-900 text-sm dark:bg-emerald-950 dark:text-emerald-200">
            Connected. Everything below is now switched on.
          </div>
        )}
        {added && (
          <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-900 text-sm dark:bg-emerald-950 dark:text-emerald-200">
            Mailbox added. Its deal emails reach the log at the next check,
            within 30 minutes.
          </div>
        )}

        <section className="space-y-4 rounded-xl border p-5">
          {status.connected ? (
            <>
              <div>
                <p className="font-medium">Connected as {status.email}</p>
                <p className="text-muted-foreground text-sm">
                  Since{' '}
                  {status.connectedAt
                    ? new Date(status.connectedAt).toLocaleDateString('en-GB')
                    : 'recently'}
                  .
                </p>
              </div>
              <form action={disconnectGoogleAccount}>
                <Button type="submit" variant="outline" size="sm">
                  Disconnect
                </Button>
              </form>
            </>
          ) : (
            <>
              <div>
                <p className="font-medium">
                  {status.broken
                    ? `Google stopped accepting the connection for ${status.email}.`
                    : 'Not connected yet.'}
                </p>
                <p className="text-muted-foreground text-sm">
                  {status.configured
                    ? 'Press Connect and sign in with the Kept account, not a personal one.'
                    : 'First add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel (both projects) and redeploy.'}
                </p>
              </div>
              {status.configured && (
                <Button asChild size="sm">
                  <a href="/api/google/connect">
                    {status.broken ? 'Reconnect Google' : 'Connect Google'}
                  </a>
                </Button>
              )}
              <div className="rounded-lg bg-muted p-3 text-sm">
                <p className="text-muted-foreground">
                  Redirect link for Google Cloud (copy it exactly):
                </p>
                <code className="break-all">{redirectUri}</code>
              </div>
            </>
          )}
        </section>

        {status.connected && (
          <section className="space-y-4 rounded-xl border p-5">
            <div>
              <h2 className="font-semibold text-base">Other Kept mailboxes</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                <li>
                  Add a colleague&rsquo;s or a shared Kept mailbox, and its{' '}
                  <strong>deal emails</strong> go in the email log too.
                </li>
                <li>
                  It is used for <strong>nothing else</strong>: no drafts,
                  calendar or Drive. Those stay on {status.email}.
                </li>
                <li>
                  Only <strong>Kept accounts</strong> can be added. Whoever adds
                  one signs in to it on the Google screen.
                </li>
                <li>
                  The same email in two mailboxes is stored{' '}
                  <strong>once</strong>.
                </li>
              </ul>
            </div>

            {extras.length > 0 && (
              <ul className="divide-y rounded-lg border">
                {extras.map((m) => (
                  <li
                    className="flex flex-wrap items-center justify-between gap-3 p-3"
                    key={m.email}
                  >
                    <div className="min-w-0">
                      <p className="break-all font-medium text-sm">{m.email}</p>
                      <p className="text-muted-foreground text-xs">
                        {m.broken
                          ? 'Google stopped accepting it. Remove it, then add it again.'
                          : `Added ${new Date(m.connectedAt).toLocaleDateString('en-GB')}.`}
                      </p>
                    </div>
                    <form action={removeGoogleMailbox}>
                      <input name="email" type="hidden" value={m.email} />
                      <Button size="sm" type="submit" variant="outline">
                        Remove
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}

            <Button asChild size="sm">
              <a href="/api/google/connect?mailbox=1">Add a mailbox</a>
            </Button>
            <p className="text-muted-foreground text-xs">
              Removing one stops it being read. Emails already in the log stay.
            </p>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="font-semibold text-base">What it does</h2>
          <ul className="divide-y rounded-xl border">
            {WHAT_IT_DOES.map(([title, detail]) => (
              <li key={title} className="p-4">
                <p className="font-medium text-sm">{title}</p>
                <p className="text-muted-foreground text-sm">{detail}</p>
              </li>
            ))}
          </ul>
        </section>

        {status.connected && (
          <section className="space-y-3 rounded-xl border p-5">
            <h2 className="font-semibold text-base">Partner sheet</h2>
            <p className="text-muted-foreground text-sm">
              Stage, area (first half of the postcode only), property type,
              bedrooms, days in stage. It refreshes each morning. Share it from
              Google Drive when you choose to.
            </p>
            <PartnerSheetButton sheetUrl={sheetUrl} />
          </section>
        )}
      </div>
    </>
  );
};

export default GoogleSettingsPage;
