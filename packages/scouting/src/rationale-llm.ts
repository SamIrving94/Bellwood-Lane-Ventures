/**
 * LLM-enriched scoring rationale.
 *
 * The deterministic `rationale` field on ScoreBreakdown is short and
 * algorithmic ("Strong lead (78/100) driven by probate, hot probate window;
 * pulled down by poor EPC"). This module turns the factor stack into 1-2
 * sentences of plain English in Bellwood voice — what a senior sourcer
 * would say when explaining the lead to the founder.
 *
 * Intended use:
 *   - Call ONLY on STRONG (or VIABLE+) leads to keep token spend low
 *   - Persist as a new column on ScoutLead (e.g. `rationaleLlm`) so the
 *     dashboard can render it directly
 *   - Run lazily / async — never block the lead-creation path
 *
 * Returns null when:
 *   - ANTHROPIC_API_KEY is not configured
 *   - Claude returns nothing parseable
 * Callers MUST fall back to ScoreBreakdown.rationale.
 */

import 'server-only';

import { callClaude } from '@repo/ai/claude';
import type { ScoreBreakdown } from './scorer';

const SYSTEM_PROMPT = `You are a senior UK property sourcer briefing the founder of Bellwood Ventures on a lead.

The founder is dyslexic — short sentences, plain English, no jargon, no marketing fluff.

You will receive a structured score breakdown from our internal scorer. Your job: write 1-2 short sentences that explain in plain English why this lead is worth (or not worth) the founder's time today.

Rules:
- Lead with what makes it interesting (the strongest positive factor in its own words).
- If there's a real negative (EPC F, flood, short lease, no contact), name it specifically.
- DO NOT recite the score number — the founder already sees it.
- DO NOT invent facts the breakdown does not mention.
- DO NOT use "AI", "machine learning", "algorithm" — these read as sales talk.
- Maximum 50 words total. Plain prose, no bullets, no headings.

Voice: professional, specific, slightly dry. Closer to a chartered surveyor than a property influencer.`;

export interface RationaleContext {
  /** Optional address for context — helps the LLM ground its prose */
  address?: string | null;
  /** Optional postcode for context */
  postcode?: string | null;
  /** Optional estate value in pence for context (not in ScoreBreakdown) */
  estateValuePence?: number | null;
}

/**
 * Build a plain-English 1-2 sentence rationale from a ScoreBreakdown.
 * Returns null if Claude is unavailable — caller falls back to
 * ScoreBreakdown.rationale.
 */
export async function enrichRationaleWithLlm(
  breakdown: ScoreBreakdown,
  context: RationaleContext = {},
): Promise<string | null> {
  // Skip the call when there is nothing meaningful to enrich.
  if (breakdown.verdict === 'INSUFFICIENT_DATA') return null;

  const positives = breakdown.factors
    .filter((f) => f.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 5)
    .map((f) => `+${f.points} ${f.label}`)
    .join('; ');

  const negatives = breakdown.factors
    .filter((f) => f.points < 0)
    .sort((a, b) => a.points - b.points)
    .slice(0, 3)
    .map((f) => `${f.points} ${f.label}`)
    .join('; ');

  const lines: string[] = [
    `Verdict: ${breakdown.verdict} (${breakdown.total}/100)`,
    `Motivation: ${breakdown.motivation} / Equity: ${breakdown.equity} / Trend: ${breakdown.marketTrend} (${breakdown.marketTrendLabel}) / Contact: ${breakdown.contactQuality} / Risk: ${breakdown.risk}`,
    `Top positives: ${positives || '(none)'}`,
    `Top negatives: ${negatives || '(none)'}`,
  ];

  if (context.address) lines.push(`Property: ${context.address}${context.postcode ? `, ${context.postcode}` : ''}`);
  if (typeof context.estateValuePence === 'number')
    lines.push(`Estate value: £${Math.round(context.estateValuePence / 100).toLocaleString('en-GB')}`);

  const text = await callClaude({
    system: SYSTEM_PROMPT,
    user: lines.join('\n'),
    maxTokens: 200,
    temperature: 0.4,
    feature: 'scoring_rationale',
  });

  if (!text) return null;
  return text.trim();
}
