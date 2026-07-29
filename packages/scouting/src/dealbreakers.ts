/**
 * Dealbreaker enforcement — the founder's hard NOs, applied automatically.
 *
 * Voice-note/notes feedback is mined into explicit rules ("never buy next to
 * a railway line", "no flats above shops") stored on FounderFeedback under
 * overrides._insights.dealbreakers. This module turns those rules into an
 * automatic screen on freshly scouted leads, the same way land/garage/SSTC
 * listings are screened — except the rules come from the founder's own
 * recorded judgement, so the screen sharpens as feedback accumulates.
 *
 * Matching is judgement, not string-matching ("backs onto the tracks" must
 * hit the railway rule), so a batched Haiku call decides. Design rules:
 *   - Violators are PARKED (status 'passed' + reason recorded), never deleted
 *     — a wrong call is visible in the Passed tab and reversible.
 *   - Graceful: no API key / model failure → no violations → leads flow
 *     exactly as before. Screening can only ever remove spend, not add risk.
 *   - Only leads worth money downstream (STRONG/VIABLE) are screened, in
 *     batches, so the cost is a few Haiku calls per day.
 */

import { CLAUDE_HAIKU, callClaudeForObject } from '@repo/ai/claude';
import { z } from 'zod';

/** Max rules sent to the screen — beyond this the prompt dilutes. */
const MAX_RULES = 20;
/** Leads per model call. */
const BATCH_SIZE = 20;

/**
 * Dedupe free-text dealbreaker rules (case/whitespace-insensitive, first
 * phrasing wins), most-recent first in = most-recent kept. Pure — tested.
 */
export function dedupeDealbreakerRules(raws: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of raws) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= MAX_RULES) break;
  }
  return out;
}

export type DealbreakerCandidate = {
  /** Caller's identifier for the lead (index, id — echoed back). */
  ref: string;
  address: string;
  summary?: string | null;
  propertyType?: string | null;
  listingType?: string | null;
};

export type DealbreakerHit = {
  ref: string;
  rule: string;
  reason: string;
};

const VERDICT_SCHEMA = z.object({
  violations: z.array(
    z.object({
      ref: z.string(),
      rule: z.string(),
      reason: z.string(),
    })
  ),
});

const SYSTEM_PROMPT = [
  "You screen UK property leads against a property investor's hard",
  'dealbreaker rules.',
  '',
  'You receive the rules and a list of leads (ref, address, listing summary).',
  'Return JSON: { "violations": [{ "ref", "rule", "reason" }] } listing ONLY',
  'leads that CLEARLY violate a rule based on the information given.',
  '',
  'Rules of judgement:',
  '- Be conservative: if the information does not clearly show a violation,',
  '  do NOT flag the lead. Absence of information is never a violation.',
  '- "reason" quotes the evidence from the lead (short).',
  '- "rule" is the violated rule verbatim.',
  '- No violations → { "violations": [] }.',
].join('\n');

/**
 * Screen leads against dealbreaker rules in batches. Returns a map of
 * ref → hit for violators only. Never throws; failures = no violations.
 */
export async function screenDealbreakers(
  rules: string[],
  leads: DealbreakerCandidate[]
): Promise<Map<string, DealbreakerHit>> {
  const hits = new Map<string, DealbreakerHit>();
  const activeRules = dedupeDealbreakerRules(rules);
  if (activeRules.length === 0 || leads.length === 0) return hits;

  const rulesBlock = activeRules.map((r, i) => `${i + 1}. ${r}`).join('\n');

  for (let i = 0; i < leads.length; i += BATCH_SIZE) {
    const batch = leads.slice(i, i + BATCH_SIZE);
    const leadsBlock = batch
      .map((l) =>
        [
          `ref: ${l.ref}`,
          `address: ${l.address}`,
          l.propertyType ? `type: ${l.propertyType}` : null,
          l.listingType ? `listing: ${l.listingType}` : null,
          l.summary ? `summary: ${l.summary.slice(0, 400)}` : null,
        ]
          .filter(Boolean)
          .join('\n')
      )
      .join('\n---\n');

    const result = await callClaudeForObject({
      system: SYSTEM_PROMPT,
      user: `Dealbreaker rules:\n${rulesBlock}\n\nLeads:\n${leadsBlock}`,
      schema: VERDICT_SCHEMA,
      maxTokens: 800,
      temperature: 0,
      model: CLAUDE_HAIKU,
      feature: 'dealbreaker_screen',
    });
    if (!result) continue;

    const validRefs = new Set(batch.map((l) => l.ref));
    for (const v of result.violations) {
      // Only accept refs from this batch — the model cannot invent leads.
      if (validRefs.has(v.ref) && !hits.has(v.ref)) {
        hits.set(v.ref, {
          ref: v.ref,
          rule: v.rule.slice(0, 200),
          reason: v.reason.slice(0, 300),
        });
      }
    }
  }
  return hits;
}
