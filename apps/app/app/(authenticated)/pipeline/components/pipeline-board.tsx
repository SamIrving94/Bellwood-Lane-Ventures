'use client';

import type { Deal, DealStatus } from '@repo/database/generated/client';
import { useState } from 'react';

type PipelineBoardProps = {
  initialDeals: Deal[];
};

const stages: { key: DealStatus; label: string; color: string }[] = [
  { key: 'new_lead', label: 'New Leads', color: 'border-t-slate-500' },
  { key: 'contacted', label: 'Contacted', color: 'border-t-blue-500' },
  { key: 'valuation', label: 'Valuation', color: 'border-t-amber-500' },
  { key: 'offer_made', label: 'Offer Made', color: 'border-t-purple-500' },
  { key: 'under_offer', label: 'Under Offer', color: 'border-t-emerald-500' },
  { key: 'exchanged', label: 'Exchanged', color: 'border-t-green-600' },
];

function formatGBP(pence: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(pence / 100);
}

function daysInStage(stageEnteredAt: Date): number {
  return Math.floor(
    (Date.now() - new Date(stageEnteredAt).getTime()) / (1000 * 60 * 60 * 24)
  );
}

export const PipelineBoard = ({ initialDeals }: PipelineBoardProps) => {
  const [deals] = useState(initialDeals);

  return (
    <div className="grid grid-cols-1 gap-4 overflow-x-auto md:grid-cols-3 lg:grid-cols-6">
      {stages.map((stage) => {
        const stageDeals = deals.filter((d) => d.status === stage.key);
        const stageValue = stageDeals.reduce(
          (sum, d) => sum + (d.ourOfferPence || d.askingPricePence || 0),
          0
        );

        return (
          <div
            key={stage.key}
            className={`flex min-h-[300px] flex-col rounded-lg border border-t-4 bg-card ${stage.color}`}
          >
            <div className="flex items-center justify-between border-b p-3">
              <h3 className="text-sm font-medium">{stage.label}</h3>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                {stageDeals.length}
              </span>
            </div>
            {stageValue > 0 && (
              <div className="border-b px-3 py-1">
                <p className="text-xs text-muted-foreground">
                  {formatGBP(stageValue)}
                </p>
              </div>
            )}
            <div className="flex-1 space-y-2 overflow-y-auto p-2">
              {stageDeals.map((deal) => (
                <a
                  key={deal.id}
                  href={`/deals/${deal.id}`}
                  className="block rounded-md border bg-background p-3 shadow-sm transition-colors hover:bg-accent"
                >
                  <p className="text-sm font-medium leading-tight">
                    {deal.address}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {deal.postcode}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    {deal.askingPricePence ? (
                      <span className="text-xs font-medium">
                        {formatGBP(deal.askingPricePence)}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        No price
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {daysInStage(deal.stageEnteredAt)}d
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="rounded bg-muted px-1 py-0.5 text-[10px] capitalize">
                      {deal.sellerType.replace('_', ' ')}
                    </span>
                    {deal.verdict && (
                      <span
                        className={`rounded px-1 py-0.5 text-[10px] font-medium ${
                          deal.verdict === 'STRONG'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                            : deal.verdict === 'VIABLE'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                              : deal.verdict === 'THIN'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}
                      >
                        {deal.verdict}
                      </span>
                    )}
                  </div>
                </a>
              ))}
              {stageDeals.length === 0 && (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  No deals
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
