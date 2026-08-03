import { database } from '@repo/database';
import type { Metadata } from 'next';
import { Header } from '../components/header';
import { PartnerForm } from './partner-form';
import { PartnerRow } from './partner-row';

export const metadata: Metadata = {
  title: 'Field network — Kept',
};

export const dynamic = 'force-dynamic';

// The field-partner network: builders / retired contractors who view
// properties for us and take refurb work orders. This page is the roster;
// assignment happens from each deal's page.

export default async function NetworkPage() {
  const partners = await database.fieldPartner.findMany({
    orderBy: [{ active: 'desc' }, { viewingsCompleted: 'desc' }],
    include: {
      _count: { select: { viewings: true, workOrders: true } },
    },
    take: 200,
  });

  const activeCount = partners.filter((p) => p.active).length;
  const areasCovered = new Set(
    partners.filter((p) => p.active).flatMap((p) => p.postcodeAreas)
  );

  return (
    <>
      <Header pages={[]} page="Field network" />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <div>
          <h1 className="font-bold text-xl">Field network</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Builders and retired contractors who view properties and take refurb
            work orders. <strong>{activeCount} active</strong> ·{' '}
            <strong>{areasCovered.size}</strong> postcode areas covered.
          </p>
        </div>

        <PartnerForm />

        {partners.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
            No field partners yet. Add your first builder above — they get a
            magic link per viewing, no account needed.
          </div>
        ) : (
          <div className="space-y-2">
            {partners.map((p) => (
              <PartnerRow
                key={p.id}
                partner={{
                  id: p.id,
                  name: p.name,
                  email: p.email,
                  phone: p.phone,
                  background: p.background,
                  postcodeAreas: p.postcodeAreas,
                  active: p.active,
                  viewingsCompleted: p.viewingsCompleted,
                  workOrderCount: p._count.workOrders,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
