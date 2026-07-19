'use server';

import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import { revalidatePath } from 'next/cache';

/**
 * Founder triage decision on a scout lead. Distinct from FounderFeedback
 * star ratings (scorer calibration) — triage is "what are WE doing with
 * this lead", shared between founders, no attribution.
 *
 * Status lifecycle: new → shortlisted | watching | passed → converted.
 * Any triage status can be changed until the lead is converted.
 */
export type TriageStatus = 'shortlisted' | 'watching' | 'passed' | 'new';

const TRIAGE_STATUSES: TriageStatus[] = [
  'shortlisted',
  'watching',
  'passed',
  'new',
];

export async function setLeadTriage(leadId: string, status: TriageStatus) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');
  if (!TRIAGE_STATUSES.includes(status)) {
    throw new Error(`Invalid triage status: ${status}`);
  }

  const lead = await database.scoutLead.findUnique({
    where: { id: leadId },
    select: { status: true },
  });
  if (!lead) throw new Error('Lead not found');
  if (lead.status === 'converted') {
    throw new Error('Lead already converted to a deal');
  }

  await database.scoutLead.update({
    where: { id: leadId },
    data: { status },
  });

  revalidatePath('/leads');
  revalidatePath('/');

  return { status };
}
