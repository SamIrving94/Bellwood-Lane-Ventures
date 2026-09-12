import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Header } from '../components/header';
import { LeadsTable } from './leads-table';

export const metadata: Metadata = {
  title: 'Leads — Kept',
  description: 'Scouted leads with scoring and verdicts',
};

const LeadsPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) => {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const { filter } = await searchParams;

  // Fetch cap. This was 200, ordered by score DESC — so once the table grew
  // past 200 rows, every NEW low-scoring lead was cut off before it reached
  // the page and could never be triaged, no matter which filter was selected.
  // The scout adds ~24/day, so that ceiling was days away from biting.
  //
  // Filtering, counts and optimistic triage all run client-side over this set,
  // so it has to be one query rather than a filtered page. 1000 rows of lead
  // metadata is a few hundred KB and the table pages the DOM at 50 cards, so
  // the cost is payload, not render. `totalCount` goes alongside it: if the
  // cap ever does bite, the founder is told rather than shown a silent slice.
  const LEADS_FETCH_CAP = 1000;

  const [leads, totalCount] = await Promise.all([
    database.scoutLead.findMany({
      orderBy: [{ leadScore: 'desc' }, { createdAt: 'desc' }],
      take: LEADS_FETCH_CAP,
    }),
    database.scoutLead.count(),
  ]);

  return (
    <>
      <Header pages={[]} page="Leads" />
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="flex justify-end gap-4">
          {/* Probate lead spreadsheet: Gazette deceased-estate notices matched
              to HM Land Registry last-sale data, newest notice first. */}
          <a
            href="/leads/export/probate"
            className="text-muted-foreground text-xs hover:text-foreground hover:underline"
          >
            Export probate CSV ↓
          </a>
          <Link
            href="/leads/calibration"
            className="text-muted-foreground text-xs hover:text-foreground hover:underline"
          >
            Scorer calibration →
          </Link>
        </div>
        <LeadsTable
          leads={leads.map((l) => {
            const raw = (l.rawPayload ?? {}) as Record<string, unknown>;
            const pd = raw.propertyData as Record<string, unknown> | undefined;
            const planning = raw.planning as
              | Record<string, unknown>
              | undefined;
            const hmo = raw.hmo as Record<string, unknown> | undefined;
            const dissolved = raw.dissolvedCompany as
              | Record<string, unknown>
              | undefined;
            const lease = raw.leaseSignal as
              | Record<string, unknown>
              | undefined;
            const avm = raw.avmFull as Record<string, unknown> | undefined;
            const sqftEvidence = avm?.sqftEvidence as
              | { poundsPerSqft?: number | null; matchedCount?: number }
              | undefined;
            const ownEpc = raw.propertyEpc as
              | { floorAreaSqm?: number | null }
              | undefined;
            // Floor area, best evidence first: the AVM's house-number-matched
            // EPC record; else the listing's own sqft; else the scout's EPC
            // read (a postcode+address search — right most of the time, not
            // verified to the house number, so it is labelled as such).
            const SQFT_PER_SQM = 10.7639;
            let floorAreaSqft: number | null = null;
            let floorAreaSource: 'epc' | 'listing' | 'epc_unverified' | null =
              null;
            if (typeof avm?.floorAreaSqm === 'number' && avm.floorAreaSource) {
              floorAreaSqft = Math.round(avm.floorAreaSqm * SQFT_PER_SQM);
              floorAreaSource = 'epc';
            } else if (typeof pd?.listingSqft === 'number') {
              floorAreaSqft = pd.listingSqft;
              floorAreaSource = 'listing';
            } else if (typeof ownEpc?.floorAreaSqm === 'number') {
              floorAreaSqft = Math.round(ownEpc.floorAreaSqm * SQFT_PER_SQM);
              floorAreaSource = 'epc_unverified';
            }
            const primeOpp = raw.primeOpportunity as
              | {
                  discountToArea?: number | null;
                  isOpportunity?: boolean;
                  reasons?: string[];
                }
              | undefined;
            return {
              id: l.id,
              address: l.address,
              postcode: l.postcode,
              leadType: l.leadType,
              track: l.track,
              leadScore: l.leadScore,
              verdict: l.verdict,
              estimatedEquityPence: l.estimatedEquityPence,
              marketTrend: l.marketTrend,
              status: l.status,
              source: l.source,
              // Rich PropertyData fields (when source is propertydata_*)
              listingType: (pd?.listingType as string | undefined) ?? null,
              listingUrl: (pd?.listingUrl as string | undefined) ?? null,
              imageUrl: (pd?.imageUrl as string | undefined) ?? null,
              summary: (pd?.summary as string | undefined) ?? null,
              pricePence: (pd?.pricePence as number | undefined) ?? null,
              originalPricePence:
                (pd?.originalPricePence as number | undefined) ?? null,
              discountPercent:
                (pd?.discountPercent as number | undefined) ?? null,
              reductionCount: (pd?.reductionCount as number | undefined) ?? 0,
              velocityScore: (pd?.velocityScore as number | undefined) ?? 0,
              bedrooms: (pd?.bedrooms as number | undefined) ?? null,
              propertyType: (pd?.propertyType as string | undefined) ?? null,
              daysOnMarket: (pd?.daysOnMarket as number | undefined) ?? null,
              // Planning + HMO labels
              planningDecision:
                (planning?.decision as string | undefined) ?? null,
              planningRating:
                (planning?.decisionRating as string | undefined) ?? null,
              planningProposal:
                (planning?.proposal as string | undefined) ?? null,
              planningUrl: (planning?.url as string | undefined) ?? null,
              hmoExpiringSoon:
                (hmo?.licenceExpiringSoon as boolean | undefined) ?? false,
              hmoLicenceExpiry:
                (hmo?.licenceExpiry as string | undefined) ?? null,
              // Dissolved company
              dissolvedCompanyName:
                (dissolved?.companyName as string | undefined) ?? null,
              dissolvedAt:
                (dissolved?.dissolvedAt as string | undefined) ?? null,
              // Short-lease signal (when source is short_lease_*)
              leaseRemainingYears:
                (lease?.remainingLeaseYears as number | undefined) ?? null,
              leaseMarriageValue:
                (lease?.marriageValue as boolean | undefined) ?? false,
              // Appraisal status (lead has been run through the AVM)
              appraised: typeof avm?.pointEstimatePence === 'number',
              avmValuePence:
                (avm?.pointEstimatePence as number | undefined) ?? null,
              avmConfidence:
                (avm?.confidenceLevel as string | undefined) ?? null,
              // Size: sqft + where it came from, £/sqft of this house at the
              // AVM, and what nearby sold comps fetched per sqft.
              floorAreaSqft,
              floorAreaSource,
              pricePerSqft: (avm?.pricePerSqft as number | undefined) ?? null,
              areaPerSqft: sqftEvidence?.poundsPerSqft ?? null,
              areaPerSqftComps: sqftEvidence?.matchedCount ?? 0,
              // Risk flags + score factors (computed scorer-side, stored on
              // rawPayload by the cron — pull defensively for older leads)
              riskFlags: (raw.riskFlags as string[] | undefined) ?? [],
              rationale: (raw.rationale as string | undefined) ?? null,
              topPositiveFactors: (
                (raw.scoreFactors as
                  | Array<{
                      label: string;
                      points: number;
                    }>
                  | undefined) ?? []
              )
                .filter((f) => f.points > 0)
                .sort((a, b) => b.points - a.points)
                .slice(0, 3)
                .map((f) => f.label),
              primeIsOpportunity: primeOpp?.isOpportunity === true,
              primeDiscountPct:
                typeof primeOpp?.discountToArea === 'number'
                  ? Math.round(primeOpp.discountToArea * 100)
                  : null,
              primeReasons: primeOpp?.reasons ?? [],
              // Cornerstone tier (£1.5M+ inside prime) + ripe-for-modernisation
              // evidence — both stamped by the scout on rawPayload.
              cornerstone: raw.cornerstone === true,
              modernisationRipe:
                (raw.modernisation as { ripe?: boolean } | undefined)?.ripe ===
                true,
              modernisationReasons:
                (raw.modernisation as { reasons?: string[] } | undefined)
                  ?.reasons ?? [],
            };
          })}
          initialFilter={filter ?? 'new'}
          totalCount={totalCount}
        />
      </div>
    </>
  );
};

export default LeadsPage;
