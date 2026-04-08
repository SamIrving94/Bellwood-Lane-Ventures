import { currentUser } from '@repo/auth/server';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Header } from '../components/header';

export const metadata: Metadata = {
  title: 'Settings — Bellwood Ventures',
};

const SettingsPage = async () => {
  const user = await currentUser();

  if (!user) {
    redirect('/sign-in');
  }

  return (
    <>
      <Header pages={[]} page="Settings" />
      <div className="flex flex-1 flex-col gap-8 p-6">
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-base font-semibold">Account</h2>
            <p className="text-sm text-muted-foreground">
              Your account details from Clerk.
            </p>
          </div>
          <div className="rounded-xl border p-5">
            <dl className="flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Email</dt>
                <dd>{user.emailAddresses.at(0)?.emailAddress ?? '—'}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Name</dt>
                <dd>
                  {[user.firstName, user.lastName].filter(Boolean).join(' ') ||
                    '—'}
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-base font-semibold">API Keys</h2>
            <p className="text-sm text-muted-foreground">
              Configure external service API keys for property data, valuations, and email.
            </p>
          </div>
          <div className="rounded-xl border p-5">
            <p className="text-sm text-muted-foreground">
              API key management coming soon. Currently configured via environment variables.
            </p>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-base font-semibold">Notifications</h2>
            <p className="text-sm text-muted-foreground">
              Configure SLA breach alerts and deal update notifications.
            </p>
          </div>
          <div className="rounded-xl border p-5">
            <p className="text-sm text-muted-foreground">
              Notification preferences coming soon.
            </p>
          </div>
        </section>
      </div>
    </>
  );
};

export default SettingsPage;
