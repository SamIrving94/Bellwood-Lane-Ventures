'use server';

import { requireFounder } from '@repo/auth/server';
import { database } from '@repo/database';
import { propensityForLeadType } from '@repo/scouting/src/propensity';
import { revalidatePath } from 'next/cache';

export async function convertLeadToDeal(leadId: string) {
  const { userId } = await requireFounder();

  const lead = await database.scoutLead.findUnique({
    where: { id: leadId },
  });

  if (!lead) throw new Error('Lead not found');
  if (lead.status === 'converted') throw new Error('Lead already converted');

  // Create deal from lead data
  const deal = await database.deal.create({
    data: {
      address: lead.address,
      postcode: lead.postcode,
      propertyType: lead.leadType, // Will be refined later
      sellerType: lead.leadType === 'probate'
        ? 'probate'
        : lead.leadType === 'chain_break'
          ? 'chain_break'
          : lead.leadType === 'repossession'
            ? 'repossession'
            : lead.leadType === 'short_lease'
              ? 'short_lease'
              : 'standard',
      source: 'scout_lead',
      track: lead.track,
      sellerName: lead.contactName,
      sellerEmail: lead.contactEmail,
      sellerPhone: lead.contactPhone,
      convertedFromLeadId: lead.id,
    },
  });

  // Update lead status
  await database.scoutLead.update({
    where: { id: leadId },
    data: {
      status: 'converted',
      convertedDealId: deal.id,
    },
  });

  // Log activity
  await database.dealActivity.create({
    data: {
      dealId: deal.id,
      action: 'deal_created',
      detail: `Converted from scout lead (score: ${lead.leadScore}, verdict: ${lead.verdict})`,
      userId,
    },
  });

  // Calibration logging for the propensity curves: record how many days
  // after its t=0 signal this lead actually converted, and what the curve
  // claimed at that moment. The probate curve's anchor (a Gazette s.27
  // notice can land before OR after the Grant) is an unverified prior — this
  // event stream is the data that will confirm or correct the curve shapes.
  // Best-effort: never blocks a conversion.
  try {
    const raw = (lead.rawPayload ?? {}) as Record<string, unknown>;
    let daysSinceSignal: number | null = null;
    if (typeof raw.grantDate === 'string') {
      const ms = new Date(raw.grantDate).getTime();
      if (Number.isFinite(ms)) {
        daysSinceSignal = Math.max(
          0,
          Math.floor((Date.now() - ms) / 86_400_000)
        );
      }
    }
    if (daysSinceSignal === null && typeof raw.daysSinceGrant === 'number') {
      const rowAgeDays = Math.max(
        0,
        Math.floor((Date.now() - lead.createdAt.getTime()) / 86_400_000)
      );
      daysSinceSignal = Math.max(0, raw.daysSinceGrant) + rowAgeDays;
    }
    const propensity =
      daysSinceSignal === null
        ? null
        : propensityForLeadType(lead.leadType, daysSinceSignal);
    await database.agentEvent.create({
      data: {
        agent: 'scout',
        eventType: 'propensity_conversion',
        summary: `Lead converted at day ${daysSinceSignal ?? '?'} since signal (${lead.leadType})`,
        dealId: deal.id,
        payload: {
          leadId: lead.id,
          leadType: lead.leadType,
          daysSinceSignal,
          signalDate: typeof raw.grantDate === 'string' ? raw.grantDate : null,
          curveValueAtConversion: propensity?.hasCurve
            ? propensity.value
            : null,
          curvePhaseAtConversion: propensity?.hasCurve
            ? propensity.label
            : null,
          leadScore: lead.leadScore,
          verdict: lead.verdict,
        },
      },
    });
  } catch (err) {
    console.warn('[actions/leads/convert] propensity logging failed', err);
  }

  revalidatePath('/pipeline');
  revalidatePath('/leads');
  revalidatePath('/');

  return deal;
}
