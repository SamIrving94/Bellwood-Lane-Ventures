/**
 * @repo/auctions — Free UK Auction Data Scraper
 *
 * Aggregates upcoming lots + past results from free public auction
 * catalogues. Skips EIG (the paid industry standard) on purpose.
 *
 * Sources:
 *   - Auction House UK (nationwide)
 *   - Savills (nationwide)
 *   - Clive Emson (southern England)
 *
 * Usage:
 *   import { getUpcomingAuctions } from '@repo/auctions';
 *   const lots = await getUpcomingAuctions({ maxGuidePricePence: 100_000_00 });
 */

import 'server-only';

import { fetchAuctionHouseUKUpcoming, fetchAuctionHouseUKResults } from './sources/auction-house';
import { fetchSavillsUpcoming, fetchSavillsResults } from './sources/savills';
import { fetchCliveEmsonUpcoming, fetchCliveEmsonResults } from './sources/clive-emson';
import type { AuctionLot, AuctionResult, AuctionFilters } from './types';

export type {
  AuctionLot,
  AuctionResult,
  AuctionFilters,
  AuctionHouse,
  PropertyType,
} from './types';

/**
 * Fetch upcoming auction lots across all free sources, apply filters,
 * and return a de-duplicated list.
 */
export async function getUpcomingAuctions(
  filters: AuctionFilters = {}
): Promise<AuctionLot[]> {
  const sources = filters.sourceHouses ?? [
    'auction_house_uk',
    'savills',
    'clive_emson',
  ];

  const jobs: Promise<AuctionLot[]>[] = [];
  if (sources.includes('auction_house_uk')) jobs.push(fetchAuctionHouseUKUpcoming());
  if (sources.includes('savills')) jobs.push(fetchSavillsUpcoming());
  if (sources.includes('clive_emson')) jobs.push(fetchCliveEmsonUpcoming());

  const settled = await Promise.allSettled(jobs);
  const all: AuctionLot[] = [];
  for (const r of settled) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }

  return applyFilters(all, filters);
}

/**
 * Fetch past auction results — useful for back-testing and AVM calibration.
 */
export async function getPastAuctionResults(
  filters: AuctionFilters = {}
): Promise<AuctionResult[]> {
  const sources = filters.sourceHouses ?? [
    'auction_house_uk',
    'savills',
    'clive_emson',
  ];

  const jobs: Promise<AuctionResult[]>[] = [];
  if (sources.includes('auction_house_uk')) jobs.push(fetchAuctionHouseUKResults());
  if (sources.includes('savills')) jobs.push(fetchSavillsResults());
  if (sources.includes('clive_emson')) jobs.push(fetchCliveEmsonResults());

  const settled = await Promise.allSettled(jobs);
  const all: AuctionResult[] = [];
  for (const r of settled) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }

  // Filters typed for AuctionLot apply to AuctionResult too (it extends it)
  return applyFilters(all, filters);
}

function applyFilters<T extends AuctionLot>(lots: T[], f: AuctionFilters): T[] {
  return lots.filter((lot) => {
    if (f.fromDate && lot.auctionDate < new Date(f.fromDate)) return false;
    if (f.toDate && lot.auctionDate > new Date(f.toDate)) return false;

    if (f.propertyTypes && !f.propertyTypes.includes(lot.propertyType)) return false;

    if (f.postcodeAreas && f.postcodeAreas.length > 0) {
      const area = lot.postcode.split(' ')[0] ?? '';
      const letters = area.replace(/[0-9]/g, '');
      const match = f.postcodeAreas.some(
        (p) => area.startsWith(p) || letters === p
      );
      if (!match) return false;
    }

    if (f.maxGuidePricePence != null && lot.guidePriceMinPence != null) {
      if (lot.guidePriceMinPence > f.maxGuidePricePence) return false;
    }
    if (f.minGuidePricePence != null && lot.guidePriceMaxPence != null) {
      if (lot.guidePriceMaxPence < f.minGuidePricePence) return false;
    }

    return true;
  });
}
