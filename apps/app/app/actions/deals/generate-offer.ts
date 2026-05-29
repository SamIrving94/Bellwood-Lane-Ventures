'use server';

import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import { mergeOfferConfig, runAVM } from '@repo/valuation';
import { revalidatePath } from 'next/cache';

// Map a free-text deal.propertyType onto the AVM's PropertyType enum.
const PROPERTY_TYPE_MAP: Record<string, string> = {
  detached: 'detached',
  'semi-detached': 'semi-detached',
  semi: 'semi-detached',
  terraced: 'terraced',
  terrace: 'terraced',
  flat: 'flat',
  apartment: 'flat',
  bungalow: 'detached',
};

const SELLER_TYPE_MAP: Record<string, string> = {
  probate: 'probate',
  chain_break: 'chain_break',
  short_lease: 'short_lease',
  repossession: 'repossession',
  relocation: 'relocation',
  standard: 'standard',
};

/**
 * Founder-triggered offer generation for a deal. This is a manual, one-click
 * version of the daily `pipeline-appraise` cron: it runs the canonical AVM
 * engine, persists the result, and populates the deal's EMV / offer / margin
 * so the founder no longer types those numbers by hand. The founder can still
 * override every figure afterwards via the valuation feedback panel.
 */
export async function generateDealOffer(dealId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const deal = await database.deal.findUnique({
    where: { id: dealId },
    select: {
      id: true,
      address: true,
      postcode: true,
      propertyType: true,
      bedrooms: true,
      sellerType: true,
    },
  });
  if (!deal) throw new Error('Deal not found');

  const avmPropertyType =
    PROPERTY_TYPE_MAP[deal.propertyType.toLowerCase()] ?? 'terraced';
  const avmSellerType = SELLER_TYPE_MAP[deal.sellerType] ?? 'standard';

  // Founder-tuned offer policy: highest active avm_confidence EvalConfig wins.
  // No active config → built-in defaults (unchanged behaviour).
  const activeConfig = await database.evalConfig.findFirst({
    where: { evalType: 'avm_confidence', activatedAt: { not: null } },
    orderBy: { version: 'desc' },
    select: { version: true, config: true },
  });
  const offerConfig = mergeOfferConfig(activeConfig?.config);
  const evalConfigVersion = activeConfig?.version ?? null;

  const avm = await runAVM({
    postcode: deal.postcode,
    propertyType: avmPropertyType as never,
    address: deal.address,
    bedrooms: deal.bedrooms ?? undefined,
    sellerType: avmSellerType as never,
    dealId: deal.id,
    offerConfig,
  });

  const r = avm.resultJson;

  // Persist the valuation run so the deal page's "Latest Valuation" + feedback
  // panel pick it up (same shape the cron writes).
  await database.avmResult.create({
    data: {
      dealId: deal.id,
      postcode: avm.postcode,
      propertyType: avm.propertyType,
      riskScore: avm.riskScore,
      resultJson: avm.resultJson as never,
      expiresAt: avm.expiresAt,
      evalConfigVersion,
    },
  });

  // Margin here = how far the offer sits below the AVM point estimate, so the
  // founder reads it as "discount to market" (matches the 20-25% offer rule).
  const marginPercent =
    r.avmPointEstimate > 0
      ? ((r.avmPointEstimate - r.finalOffer) / r.avmPointEstimate) * 100
      : null;

  const verdict = r.requiresCeoEscalation
    ? 'THIN'
    : r.confidenceLevel === 'high'
      ? 'STRONG'
      : 'VIABLE';

  await database.deal.update({
    where: { id: deal.id },
    data: {
      estimatedMarketValuePence: Math.round(r.avmPointEstimate),
      ourOfferPence: Math.round(r.finalOffer),
      marginPercent,
      verdict,
    },
  });

  const offerLabel = (r.finalOffer / 100).toLocaleString('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  });

  await database.dealActivity.create({
    data: {
      dealId: deal.id,
      action: 'offer_generated',
      detail: `Founder ran valuation: offer ${offerLabel}, risk ${avm.riskScore}/100${
        r.requiresCeoEscalation ? ' — CEO escalation (offer <60% AVM)' : ''
      }`,
      userId,
    },
  });

  revalidatePath(`/deals/${deal.id}`);

  return {
    offerPence: Math.round(r.finalOffer),
    estimatedMarketValuePence: Math.round(r.avmPointEstimate),
    marginPercent,
    riskScore: avm.riskScore,
    verdict,
    requiresReview: r.requiresCeoEscalation || r.discountCapped,
    preRicsFlags: r.preRicsFlags ?? [],
  };
}
