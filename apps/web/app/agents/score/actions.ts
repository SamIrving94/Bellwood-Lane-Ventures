'use server';

import { generateInstantOffer } from '@repo/instant-offer';
import { runPreflightChecks } from '@repo/property-data/src/propertydata';
import type { PropertyType } from '@repo/valuation';

function coercePropertyType(raw: string): PropertyType {
  switch (raw) {
    case 'terraced':
    case 'terraced_house':
      return 'terraced';
    case 'semi-detached':
    case 'semi_detached':
      return 'semi-detached';
    case 'detached':
      return 'detached';
    case 'flat':
      return 'flat';
    default:
      return 'terraced';
  }
}

const FULL_POSTCODE_RE = /^[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}$/i;

/**
 * Bellwood Score — indicative offer range for an agent during a valuation
 * appointment. Runs the same AVM as /api/quote (without persisting), plus a
 * preflight that pulls EPC + tenure + market temperature. Returns a range
 * tagged INDICATIVE — explicitly NOT a confirmed offer.
 */
export async function calculateBellwoodScore(input: {
  postcode: string;
  address?: string;
  propertyType: string;
  bedrooms?: number;
  condition?: number;
  situation?: string;
}): Promise<
  | {
      ok: true;
      indicativeMinPence: number;
      indicativeMaxPence: number;
      indicativeMidPence: number;
      avmMinPence: number;
      avmMaxPence: number;
      offerPercentOfAvm: number;
      confidenceScore: number;
      reasoning: string[];
      epcRating: string | null;
      tenure: string | null;
      remainingLeaseYears: number | null;
      marketBand: string | null;
    }
  | { ok: false; error: string }
> {
  const postcode = input.postcode.trim().toUpperCase();
  if (!FULL_POSTCODE_RE.test(postcode.replace(/\s+/g, ''))) {
    return { ok: false, error: 'Please enter a full UK postcode (e.g. M14 5LL).' };
  }

  const propertyType = coercePropertyType(input.propertyType);
  const situation =
    (input.situation as
      | 'probate'
      | 'chain_break'
      | 'repossession'
      | 'relocation'
      | 'short_lease'
      | 'problem_property'
      | 'other'
      | undefined) ?? 'other';

  try {
    const [offer, preflight] = await Promise.all([
      generateInstantOffer({
        postcode,
        address: input.address,
        propertyType,
        bedrooms: input.bedrooms,
        condition: input.condition,
        situation,
      }),
      runPreflightChecks({ postcode, address: input.address }).catch(
        () => null,
      ),
    ]);

    // Apply the same ±5% temperature adjustment used by /api/quote so the
    // Bellwood Score matches what a real submission would see.
    const adjPct = Math.max(
      -0.05,
      Math.min(0.05, preflight?.offerAdjustment ?? 0),
    );
    const indicativeMidPence = Math.round(offer.offerPence * (1 + adjPct));

    // Indicative range = ±3% around the adjusted mid. Wider than the AVM
    // confidence band but tighter than the AVM range, so it reads as a
    // headline range without overcommitting.
    const indicativeMinPence = Math.round(indicativeMidPence * 0.97);
    const indicativeMaxPence = Math.round(indicativeMidPence * 1.03);

    return {
      ok: true,
      indicativeMinPence,
      indicativeMaxPence,
      indicativeMidPence,
      avmMinPence: offer.estimatedMarketValueMinPence,
      avmMaxPence: offer.estimatedMarketValueMaxPence,
      offerPercentOfAvm: offer.offerPercentOfAvm,
      confidenceScore: offer.confidenceScore,
      reasoning: [
        ...offer.reasoning.slice(0, 4),
        ...(preflight?.reasoning ?? []).slice(0, 3),
      ],
      epcRating: preflight?.epc.rating ?? null,
      tenure: preflight?.tenure.tenure ?? null,
      remainingLeaseYears: preflight?.tenure.remainingLeaseYears ?? null,
      marketBand: preflight?.marketTemperature.band ?? null,
    };
  } catch (err) {
    return {
      ok: false,
      error: (err as Error)?.message ?? 'Score calculation failed',
    };
  }
}
