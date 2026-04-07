import { currentUser } from '@repo/auth/server';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getLinkedPhone } from '../../actions/phone/get';
import { getPreferences } from '../../actions/preferences/get';
import { Header } from '../components/header';
import { PhoneForm } from './phone-form';
import { PreferencesForm } from './preferences-form';

export const metadata: Metadata = {
  title: 'Settings · Microjournal',
};

const SettingsPage = async () => {
  const user = await currentUser();

  if (!user) {
    redirect('/sign-in');
  }

  const [phoneResult, prefsResult] = await Promise.all([
    getLinkedPhone(),
    getPreferences(),
  ]);
  const currentPhone = 'data' in phoneResult ? phoneResult.data : null;
  const prefs = 'data' in prefsResult ? prefsResult.data : null;

  return (
    <>
      <Header pages={[]} page="Settings" />
      <div className="flex flex-1 flex-col gap-8 p-6">
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-base font-semibold">WhatsApp</h2>
            <p className="text-sm text-muted-foreground">
              Link your WhatsApp number to send journal entries via message.
            </p>
          </div>
          <div className="rounded-xl border p-5">
            <PhoneForm
              currentPhone={currentPhone}
              twilioNumber={process.env.TWILIO_WHATSAPP_NUMBER ?? null}
              sandboxKeyword={process.env.TWILIO_SANDBOX_KEYWORD ?? null}
            />
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-base font-semibold">Daily prompt</h2>
            <p className="text-sm text-muted-foreground">
              Choose when you receive your daily journaling prompt.
            </p>
          </div>
          <div className="rounded-xl border p-5">
            <PreferencesForm
              currentHour={prefs?.promptHour ?? 18}
              currentTimezone={prefs?.timezone ?? 'UTC'}
            />
          </div>
        </section>

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
      </div>
    </>
  );
};

export default SettingsPage;
