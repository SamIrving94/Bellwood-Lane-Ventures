import 'server-only';

import { CLAUDE_HAIKU, callClaudeForObject } from '@repo/ai/claude';
import { z } from 'zod';
import {
  INSIGHT_THEMES,
  normaliseInsights,
  type FeedbackInsights,
} from './insight-schema';

/**
 * Feedback insight extraction — turn a founder's free-form note (usually a
 * voice-note transcript) into structured taste signals.
 *
 * This is the IP-building step: a star rating says HOW MUCH the founder
 * liked a property; the extracted themes say WHY. Aggregated over months of
 * feedback, that becomes a proprietary preference dataset ("the taste
 * profile") that no off-the-shelf scorer has — it powers the calibration
 * page and, eventually, scorer tuning.
 *
 * Graceful: no API key / model failure / junk output → null. Feedback
 * submission never depends on this succeeding.
 */

export {
  INSIGHT_THEMES,
  THEME_LABELS,
  normaliseInsights,
} from './insight-schema';
export type {
  FeedbackInsights,
  InsightTheme,
  ThemeSignal,
} from './insight-schema';

const SYSTEM_PROMPT = [
  'You extract structured property-preference signals from a UK property',
  "investor's spoken or written note about a specific property lead.",
  '',
  `Allowed theme values (use ONLY these): ${INSIGHT_THEMES.join(', ')}`,
  '',
  'Rules:',
  '- A theme goes in likes when spoken of favourably, dislikes when not.',
  '- Only include themes the note actually mentions. Empty arrays are fine.',
  '- dealbreakers are only explicit hard rules ("never buy next to a railway"),',
  '  not ordinary dislikes.',
  '- Quotes are short fragments of the note, not invented text.',
  '- summary is one plain-English sentence.',
].join('\n');

/**
 * Extract structured insights from a feedback note. Returns null when the
 * note is too short to carry signal or the model is unavailable/unusable.
 */
export async function extractFeedbackInsights(
  notes: string,
  context?: { address?: string | null; leadType?: string | null }
): Promise<FeedbackInsights | null> {
  const trimmed = notes.trim();
  // A couple of words ("great", "nah") carries no theme signal — skip the call.
  if (trimmed.length < 12) return null;

  const contextLine = context?.address
    ? `Property: ${context.address}${context.leadType ? ` (${context.leadType})` : ''}\n\n`
    : '';

  // Schema-guaranteed structured output — this lands in the database, so
  // the shape must be valid or the call must fail (callClaudeForObject).
  const signalSchema = z.object({
    theme: z.enum(INSIGHT_THEMES),
    quote: z.string(),
  });
  const raw = await callClaudeForObject({
    system: SYSTEM_PROMPT,
    user: `${contextLine}Note:\n"""\n${trimmed.slice(0, 4000)}\n"""`,
    schema: z.object({
      sentiment: z.enum(['positive', 'negative', 'mixed', 'neutral']),
      likes: z.array(signalSchema),
      dislikes: z.array(signalSchema),
      dealbreakers: z.array(z.string()),
      summary: z.string(),
    }),
    maxTokens: 700,
    temperature: 0,
    model: CLAUDE_HAIKU,
    feature: 'feedback_insight_extraction',
  });

  // callClaudeForObject already schema-validated; normalise still clamps
  // lengths and drops empty results so a no-signal note stores nothing.
  return normaliseInsights(raw, {
    extractedAt: new Date().toISOString(),
    model: CLAUDE_HAIKU,
  });
}
