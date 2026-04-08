import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Header } from '../components/header';

export const metadata: Metadata = {
  title: 'Contacts — Bellwood Ventures',
  description: 'CRM contacts — estate agents, solicitors, vendors, investors',
};

const typeLabels: Record<string, string> = {
  estate_agent: 'Estate Agent',
  solicitor: 'Solicitor',
  vendor: 'Vendor',
  investor: 'Investor',
  sourcer: 'Sourcer',
};

const ContactsPage = async () => {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const contacts = await database.contact.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });

  return (
    <>
      <Header pages={[]} page="Contacts" />
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {contacts.length} contacts
          </p>
        </div>

        {contacts.length === 0 ? (
          <div className="rounded-lg border bg-card p-8 text-center">
            <p className="text-muted-foreground">
              No contacts yet. Add estate agents, solicitors, vendors, and investors here.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className="rounded-lg border bg-card p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{contact.name}</p>
                    {contact.company && (
                      <p className="text-sm text-muted-foreground">
                        {contact.company}
                      </p>
                    )}
                  </div>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                    {typeLabels[contact.type] || contact.type}
                  </span>
                </div>
                <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                  {contact.email && <p>{contact.email}</p>}
                  {contact.phone && <p>{contact.phone}</p>}
                  {contact.location && <p>{contact.location}</p>}
                </div>
                {contact.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {contact.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded bg-muted px-1.5 py-0.5 text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default ContactsPage;
