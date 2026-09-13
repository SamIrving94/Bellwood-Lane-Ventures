/**
 * Listing-text motivation read — is this seller actually motivated?
 *
 * ## Why
 *
 * Scoring is rule-based and the lead type for a listing comes from WHICH
 * PropertyData distress list it arrived on (lead-type.ts). That is real
 * but coarse: a "reduced" listing whose description says "executor sale,
 * no onward chain, cash buyers preferred" carries the strongest motivation
 * on the feed and, until now, scored exactly like a landlord trimming the
 * price. The evidence was in the text we had already paid for. Nobody
 * read it.
 *
 * ## What this does
 *
 * A batched Haiku call reads every listing description and returns, from a
 * CLOSED vocabulary (motivation-signals.ts):
 *   - level: strong / some / none
 *   - signals: the motivation phrases the text actually contains
 *   - leadType: the seller reason the text states outright, or null
 *   - evidence: a short quote
 *
 * The pipeline then (a) upgrades the lead type when the text states a
 * stronger reason than the list implied (never downgrades), and (b) hands
 * the signals to the scorer as a capped acquisition factor. Both are
 * visible verbatim on the lead page — Steps, not Thoughts.
 *
 * ## Rules
 *   - Conservative: absence of text is never evidence. Only listings with a
 *     real description are read; the model is told not to infer.
 *   - Refs are validated: the model cannot invent or re-label leads.
 *   - Graceful: no key / model failure / bad row → no read → the lead
 *     scores exactly as before. The read can only add signal.
 *   - Bounded: batches of 20, a per-run cap, a deadline hook between
 *     waves. ~600 listings ≈ 30 Haiku calls ≈ pennies.
 *   - Routable: feature 'listing_motivation_read' on Settings → AI models.
 */

import { CLAUDE_HAIKU, callClaudeForObject } from '@repo/ai/claude';
import { z } from 'zod';
import {
  MOTIVATION_LEAD_TYPES,
  MOTIVATION_SIGNALS,
  type MotivationRead,
} from './motivation-signals';

export const MOTIVATION_FEATURE = 'listing_motivation_read';

/** Listings per model call. */
const BATCH_SIZE = 20;
/** Batches in flight at once. */
const CONCURRENCY = 4;
/** Hard cap per pipeline run — spend guard, not a quality choice. */
export const MAX_MOTIVATION_READS_PER_RUN = 600;
/** Below this the "description" is a title, not evidence. */
const MIN_SUMMARY_CHARS = 40;
/** Per-listing text sent to the model. */
const SUMMARY_CHARS = 600;

export type MotivationCandidate = {
  /** Caller's identifier — echoed back, validated. */
  ref: string;
  address: string;
  summary: string | null | undefined;
  listingType?: string | null;
  propertyType?: string | null;
};

const READ_SCHEMA = z.object({
  reads: z.array(
    z.object({
      ref: z.string(),
      level: z.enum(['strong', 'some', 'none']),
      signals: z.array(z.enum(MOTIVATION_SIGNALS)),
      leadType: z.enum(MOTIVATION_LEAD_TYPES).nullable(),
      evidence: z.string(),
    })
  ),
});

const SYSTEM_PROMPT = [
  'You read UK estate-agent listing descriptions for a property investor',
  'who buys directly from motivated sellers.',
  '',
  'For each listing decide whether the TEXT shows the seller is motivated',
  'to sell quickly or below market. Return JSON:',
  '{ "reads": [{ "ref", "level", "signals", "leadType", "evidence" }] }',
  '',
  'level:',
  '- "strong": the text states a reason to sell fast or cheap outright',
  '  (executor / deceased estate, repossession, cash buyers only, quick',
  '  sale wanted, relocation, divorce, landlord selling up, vacant + no',
  '  chain).',
  '- "some": a softer signal only (no onward chain, needs modernisation,',
  '  tenant in situ, short lease, previously at auction).',
  '- "none": nothing in the text. Most listings are "none".',
  '',
  'signals: ONLY values from the allowed list, ONLY when the text contains',
  'that signal. An empty list means level "none".',
  '',
  'leadType: the seller reason the text states OUTRIGHT, from the allowed',
  'list, else null. Do not infer: "no chain" alone is NOT probate; "needs',
  'work" alone is NOT empty_property. Executor / deceased estate → probate.',
  '',
  'evidence: a short quote (under 120 characters) from the listing.',
  '',
  'Rules of judgement:',
  '- Absence of information is never a signal. Marketing filler ("must be',
  '  seen", "priced to sell") is not a signal.',
  '- Return one entry per ref, every ref exactly once, nothing else.',
].join('\n');

/**
 * Read motivation from listing text in batches. Returns ref → read for
 * listings that had enough text to read (level may still be 'none').
 * Never throws; a failed batch simply yields no reads for its listings.
 */
export async function readListingMotivation(
  candidates: MotivationCandidate[],
  opts: { shouldStop?: () => boolean } = {}
): Promise<Map<string, MotivationRead>> {
  const reads = new Map<string, MotivationRead>();
  const readable = candidates
    .filter((c) => (c.summary ?? '').trim().length >= MIN_SUMMARY_CHARS)
    .slice(0, MAX_MOTIVATION_READS_PER_RUN);
  if (readable.length === 0) {
    return reads;
  }

  const batches: MotivationCandidate[][] = [];
  for (let i = 0; i < readable.length; i += BATCH_SIZE) {
    batches.push(readable.slice(i, i + BATCH_SIZE));
  }

  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    if (opts.shouldStop?.()) {
      break;
    }
    const wave = batches.slice(i, i + CONCURRENCY);
    const results = await Promise.all(wave.map((b) => readBatch(b)));
    for (const map of results) {
      for (const [ref, read] of map) {
        reads.set(ref, read);
      }
    }
  }
  return reads;
}

async function readBatch(
  batch: MotivationCandidate[]
): Promise<Map<string, MotivationRead>> {
  const out = new Map<string, MotivationRead>();
  const block = batch
    .map((c) =>
      [
        `ref: ${c.ref}`,
        `address: ${c.address}`,
        c.propertyType ? `type: ${c.propertyType}` : null,
        c.listingType ? `list: ${c.listingType}` : null,
        `text: ${(c.summary ?? '').replace(/\s+/g, ' ').trim().slice(0, SUMMARY_CHARS)}`,
      ]
        .filter(Boolean)
        .join('\n')
    )
    .join('\n---\n');

  const result = await callClaudeForObject({
    system: SYSTEM_PROMPT,
    user: `Allowed signals: ${MOTIVATION_SIGNALS.join(', ')}\nAllowed leadType: ${MOTIVATION_LEAD_TYPES.join(', ')}\n\nListings:\n${block}`,
    schema: READ_SCHEMA,
    maxTokens: 2500,
    temperature: 0,
    model: CLAUDE_HAIKU,
    feature: MOTIVATION_FEATURE,
    attemptTimeoutMs: 45_000,
  });
  if (!result) {
    return out;
  }

  const validRefs = new Set(batch.map((c) => c.ref));
  for (const r of result.reads) {
    // The model cannot invent or double-label leads.
    if (!validRefs.has(r.ref) || out.has(r.ref)) {
      continue;
    }
    const signals = Array.from(new Set(r.signals));
    // Internal consistency beats the model's own level field: no signals
    // means nothing was found, and a lead type needs a real level behind it.
    const level = signals.length === 0 ? 'none' : r.level;
    out.set(r.ref, {
      level,
      signals,
      leadType: level === 'none' ? null : r.leadType,
      evidence: r.evidence.slice(0, 160),
    });
  }
  return out;
}
