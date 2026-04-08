import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Header } from '../components/header';

export const metadata: Metadata = {
  title: 'Leads — Bellwood Ventures',
  description: 'Scouted leads with scoring and verdicts',
};

function formatGBP(pence: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(pence / 100);
}

const verdictColors: Record<string, string> = {
  STRONG: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  VIABLE: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  THIN: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  PASS: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  INSUFFICIENT_DATA: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

const LeadsPage = async () => {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const leads = await database.scoutLead.findMany({
    orderBy: [{ leadScore: 'desc' }, { createdAt: 'desc' }],
    take: 100,
  });

  return (
    <>
      <Header pages={[]} page="Leads" />
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {leads.length} leads scored and ranked
          </p>
        </div>

        {leads.length === 0 ? (
          <div className="rounded-lg border bg-card p-8 text-center">
            <p className="text-muted-foreground">
              No leads yet. Run a scouting pipeline or import leads to get started.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Address</th>
                  <th className="px-4 py-3 text-left font-medium">Type</th>
                  <th className="px-4 py-3 text-left font-medium">Score</th>
                  <th className="px-4 py-3 text-left font-medium">Verdict</th>
                  <th className="px-4 py-3 text-left font-medium">Equity</th>
                  <th className="px-4 py-3 text-left font-medium">Trend</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {leads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="transition-colors hover:bg-accent"
                  >
                    <td className="px-4 py-3">
                      <a
                        href={`/leads/${lead.id}`}
                        className="font-medium hover:underline"
                      >
                        {lead.address}
                      </a>
                      <p className="text-xs text-muted-foreground">
                        {lead.postcode}
                      </p>
                    </td>
                    <td className="px-4 py-3 capitalize">
                      {lead.leadType.replace('_', ' ')}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono font-semibold">
                        {lead.leadScore}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          verdictColors[lead.verdict] || ''
                        }`}
                      >
                        {lead.verdict}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {lead.estimatedEquityPence
                        ? formatGBP(lead.estimatedEquityPence)
                        : '—'}
                    </td>
                    <td className="px-4 py-3 capitalize">
                      {lead.marketTrend || '—'}
                    </td>
                    <td className="px-4 py-3 capitalize">
                      {lead.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
};

export default LeadsPage;
