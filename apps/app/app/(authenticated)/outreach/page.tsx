import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Header } from '../components/header';

export const metadata: Metadata = {
  title: 'Outreach — Bellwood Ventures',
  description: 'Email outreach campaigns',
};

const OutreachPage = async () => {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const [campaigns, templates] = await Promise.all([
    database.outreachCampaign.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        recipients: {
          select: { status: true },
        },
      },
    }),
    database.outreachTemplate.findMany({
      orderBy: { sequence: 'asc' },
    }),
  ]);

  return (
    <>
      <Header pages={[]} page="Outreach" />
      <div className="flex flex-1 flex-col gap-6 p-6">
        {/* Templates */}
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Email Templates ({templates.length})
          </h2>
          {templates.length === 0 ? (
            <div className="rounded-lg border bg-card p-6 text-center">
              <p className="text-muted-foreground">
                No templates yet. Create email sequences for estate agents, probate solicitors, and vendor outreach.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((t) => (
                <div key={t.id} className="rounded-lg border bg-card p-4">
                  <p className="font-medium">{t.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {t.type.replace('_', ' ')} &middot; Step {t.sequence}
                    {t.delayDays > 0 && ` &middot; +${t.delayDays}d delay`}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Subject: {t.subject}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Campaigns */}
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Campaigns ({campaigns.length})
          </h2>
          {campaigns.length === 0 ? (
            <div className="rounded-lg border bg-card p-6 text-center">
              <p className="text-muted-foreground">
                No campaigns yet. Create a campaign by selecting templates and assigning contacts.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map((c) => {
                const sent = c.recipients.filter((r) => r.status !== 'pending').length;
                const total = c.recipients.length;

                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-lg border bg-card p-4"
                  >
                    <div>
                      <p className="font-medium">{c.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {sent}/{total} sent &middot; {c.status}
                      </p>
                    </div>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">
                      {c.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
};

export default OutreachPage;
