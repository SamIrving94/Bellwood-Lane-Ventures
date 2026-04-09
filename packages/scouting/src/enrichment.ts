/**
 * Lead Enrichment — Tier 1 / 2 / 3 Cascade (enrichment.ts)
 *
 * Enriches raw probate leads with contact, ownership, and equity data
 * via a three-tier cascade:
 *
 *   Tier 1: Automated platforms — ProbateData.com (85–95% match rate)
 *   Tier 2: Hybrid enrichment  — BatchData / ATTOM lookup for misses
 *   Tier 3: Manual flag        — Tags lead for courthouse research queue
 *
 * The enricher never adds GDPR-protected fields. Contact data comes only
 * from executor/solicitor-on-record sources, not next-of-kin medical files.
 */

import type { ProbateLead } from './probate-data.js';
import { goldenWindowLabel } from './probate-data.js';

// ---------------------------------------------------------------------------
// Enriched lead type
// ---------------------------------------------------------------------------

export interface EnrichedLead {
  /** Original probate reference */
  probateRef: string;
  address: string;
  postcode: string;
  leadType: string;
  grantDate: string;
  grantType: 'probate' | 'letters_of_administration' | 'unknown';
  /** Days since probate grant was issued */
  daysSinceGrant: number;
  /** Golden Window urgency label */
  goldenWindowLabel: 'hot' | 'warm' | 'cool' | 'cold';
  /** Solicitor firm managing the estate */
  solicitorFirm: string | null;
  /** Estimated gross estate value in pence */
  estateValuePence: number | null;
  /** Contact — executor or estate solicitor only */
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  /** Which tier supplied the enrichment */
  enrichmentTier: 1 | 2 | 3;
  /** Source trail for audit */
  sourceTrail: string;
}

// ---------------------------------------------------------------------------
// Tier 1 — ProbateData (automated, 85–95% accuracy)
// ---------------------------------------------------------------------------

interface Tier1Result {
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  found: boolean;
}

/**
 * Attempt Tier 1 enrichment via ProbateData.com API.
 * Requires PROBATE_DATA_API_KEY env var.
 */
async function enrichTier1(lead: ProbateLead): Promise<Tier1Result> {
  const apiKey = process.env.PROBATE_DATA_API_KEY;
  if (!apiKey) throw new Error('PROBATE_DATA_API_KEY not configured');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);

  try {
    const res = await fetch('https://api.probatedata.com/v2/lookup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        probateRef: lead.probateRef,
        postcode: lead.postcode,
        address: lead.address,
      }),
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`ProbateData API ${res.status}`);

    const data = (await res.json()) as {
      contact?: {
        name?: string;
        phone?: string;
        email?: string;
      };
      found?: boolean;
    };

    if (!data.found || !data.contact) {
      return { contactName: null, contactPhone: null, contactEmail: null, found: false };
    }

    return {
      contactName: data.contact.name ?? null,
      contactPhone: data.contact.phone ?? null,
      contactEmail: data.contact.email ?? null,
      found: true,
    };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Tier 2 — BatchData / ATTOM hybrid enrichment
// ---------------------------------------------------------------------------

interface Tier2Result {
  contactPhone: string | null;
  contactEmail: string | null;
  found: boolean;
}

/**
 * Attempt Tier 2 enrichment via BatchData (contact appending) or ATTOM
 * (property ownership lookup). Requires BATCH_DATA_API_KEY env var.
 */
async function enrichTier2(lead: ProbateLead): Promise<Tier2Result> {
  const apiKey = process.env.BATCH_DATA_API_KEY;
  if (!apiKey) throw new Error('BATCH_DATA_API_KEY not configured');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch('https://api.batchdata.com/api/v1/property/lookup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        address: lead.address,
        zip: lead.postcode.replace(/\s+/g, ''),
      }),
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`BatchData API ${res.status}`);

    const data = (await res.json()) as {
      results?: Array<{
        owner?: { phone?: string; email?: string };
      }>;
    };

    const owner = data.results?.[0]?.owner;
    if (!owner) return { contactPhone: null, contactEmail: null, found: false };

    return {
      contactPhone: owner.phone ?? null,
      contactEmail: owner.email ?? null,
      found: true,
    };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Tier 3 — Manual flag
// ---------------------------------------------------------------------------

function flagForManualResearch(lead: ProbateLead): void {
  // In production this would write to a manual-research queue or
  // create a Paperclip task. For now we emit a structured log.
  console.warn('[scouting/enrichment] Tier 3 flag:', {
    probateRef: lead.probateRef,
    address: lead.address,
    postcode: lead.postcode,
    action: 'manual_courthouse_research_required',
  });
}

// ---------------------------------------------------------------------------
// Cascade
// ---------------------------------------------------------------------------

/**
 * Enrich a single probate lead via the tier cascade.
 * Stops at the first tier that returns a match.
 * Tags leads that exhaust all tiers as Tier 3 (manual queue).
 */
export async function enrichLead(lead: ProbateLead): Promise<EnrichedLead> {
  const base: Omit<
    EnrichedLead,
    'contactName' | 'contactPhone' | 'contactEmail' | 'enrichmentTier' | 'sourceTrail'
  > = {
    probateRef: lead.probateRef,
    address: lead.address,
    postcode: lead.postcode,
    leadType: lead.grantType === 'letters_of_administration' ? 'probate_admin' : 'probate',
    grantDate: lead.grantDate,
    grantType: lead.grantType,
    daysSinceGrant: lead.daysSinceGrant,
    goldenWindowLabel: goldenWindowLabel(lead.daysSinceGrant),
    solicitorFirm: lead.solicitorFirm,
    estateValuePence: lead.estateValuePence,
  };

  // --- Tier 1 ---
  try {
    const t1 = await enrichTier1(lead);
    if (t1.found) {
      return {
        ...base,
        contactName: t1.contactName,
        contactPhone: t1.contactPhone,
        contactEmail: t1.contactEmail,
        enrichmentTier: 1,
        sourceTrail: `${lead.source} → tier1/probate-data`,
      };
    }
  } catch (err) {
    console.warn(`[scouting/enrichment] Tier 1 failed: ${(err as Error).message}`);
  }

  // --- Tier 2 ---
  try {
    const t2 = await enrichTier2(lead);
    if (t2.found) {
      // Executor name carried from probate record; Tier 2 appends phone/email
      return {
        ...base,
        contactName: lead.executorName,
        contactPhone: t2.contactPhone,
        contactEmail: t2.contactEmail,
        enrichmentTier: 2,
        sourceTrail: `${lead.source} → tier2/batchdata`,
      };
    }
  } catch (err) {
    console.warn(`[scouting/enrichment] Tier 2 failed: ${(err as Error).message}`);
  }

  // --- Tier 3 — manual queue ---
  flagForManualResearch(lead);

  return {
    ...base,
    contactName: lead.executorName,
    contactPhone: null,
    contactEmail: null,
    enrichmentTier: 3,
    sourceTrail: `${lead.source} → tier3/manual`,
  };
}

/**
 * Enrich a batch of probate leads concurrently (capped at 10 parallel).
 */
export async function enrichLeads(leads: ProbateLead[]): Promise<EnrichedLead[]> {
  const CONCURRENCY = 10;
  const results: EnrichedLead[] = [];

  for (let i = 0; i < leads.length; i += CONCURRENCY) {
    const batch = leads.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(batch.map(enrichLead));
    for (const s of settled) {
      if (s.status === 'fulfilled') {
        results.push(s.value);
      } else {
        console.error('[scouting/enrichment] lead enrichment error:', s.reason);
      }
    }
  }

  return results;
}
