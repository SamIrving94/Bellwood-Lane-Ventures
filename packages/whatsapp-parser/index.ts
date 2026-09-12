/**
 * WhatsApp intake parser — a raw group message → a typed lead.
 *
 * Goes through the shared @repo/ai client (feature 'whatsapp_intake_parse'),
 * so the model is a Settings → AI models decision and every parse lands in
 * LlmCallLog. The reply is schema-constrained AND re-validated: the message
 * body is attacker-controllable and the intake route auto-creates a
 * ScoutLead from these fields.
 */

import { CLAUDE_SONNET, callClaudeForObject } from '@repo/ai/claude';
import { keys } from '@repo/ai/keys';
import { z } from 'zod';

export const WHATSAPP_PARSE_FEATURE = 'whatsapp_intake_parse';

export type SellerSituation =
  | 'probate'
  | 'chain_break'
  | 'repossession'
  | 'relocation'
  | 'short_lease'
  | 'distressed'
  | 'unknown';

export type ParsedLead = {
  propertyAddress?: string;
  postcode?: string;
  askingPricePence?: number;
  propertyType?: string;
  sellerSituation?: SellerSituation;
  bedrooms?: number;
  contactInfo?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  urgency?: 'high' | 'medium' | 'low';
  rawNotes?: string;
  confidence: number; // 0-1
};

/**
 * Runtime shape check for the model's reply. Strips unknown keys so injected
 * fields cannot reach the ScoutLead row, and caps free text so a hostile
 * message cannot stuff the founder's queue.
 */
const ParsedLeadSchema = z.object({
  propertyAddress: z.string().max(300).optional(),
  postcode: z.string().max(12).optional(),
  askingPricePence: z.number().int().nonnegative().optional(),
  propertyType: z.string().max(60).optional(),
  sellerSituation: z
    .enum([
      'probate',
      'chain_break',
      'repossession',
      'relocation',
      'short_lease',
      'distressed',
      'unknown',
    ])
    .optional(),
  bedrooms: z.number().int().min(0).max(20).optional(),
  contactInfo: z
    .object({
      name: z.string().max(120).optional(),
      phone: z.string().max(40).optional(),
      email: z.string().max(200).optional(),
    })
    .optional(),
  urgency: z.enum(['high', 'medium', 'low']).optional(),
  rawNotes: z.string().max(4000).optional(),
  confidence: z.number().optional(),
});

const SYSTEM_PROMPT = `You are a structured-data extractor for UK property investment leads shared in WhatsApp groups.

Your job: read a raw WhatsApp message and extract lead fields into JSON.

Rules:
- Return ONLY a single JSON object, no prose, no markdown fences.
- If a field is unclear, OMIT it (do not hallucinate). For sellerSituation use "unknown" if not clearly stated.
- askingPricePence must be the asking price converted to pence (e.g. £250,000 => 25000000). If a figure has "k" it means thousands (e.g. "250k" = 25000000 pence).
- postcode should be a full or outward UK postcode (e.g. "M1 4AA" or "M1").
- sellerSituation enum (pick one): probate | chain_break | repossession | relocation | short_lease | distressed | unknown
- urgency enum: high | medium | low
- confidence is a float 0-1 reflecting how sure you are the message is a real property lead with enough data to act on. Messages with no address or price get low confidence.
- Put any unparsed-but-useful context in rawNotes.
- contactInfo may contain name/phone/email if mentioned.

Schema:
{
  "propertyAddress"?: string,
  "postcode"?: string,
  "askingPricePence"?: number,
  "propertyType"?: string,
  "sellerSituation"?: "probate" | "chain_break" | "repossession" | "relocation" | "short_lease" | "distressed" | "unknown",
  "bedrooms"?: number,
  "contactInfo"?: { "name"?: string, "phone"?: string, "email"?: string },
  "urgency"?: "high" | "medium" | "low",
  "rawNotes"?: string,
  "confidence": number
}`;

/**
 * Parse a raw WhatsApp message into a structured lead.
 *
 * Graceful: if no LLM key is set, or the call fails, returns
 * { confidence: 0, rawNotes } so callers route the intake to manual review.
 */
export async function parseWhatsAppMessage(
  rawText: string
): Promise<ParsedLead> {
  const env = keys();
  if (!(env.ANTHROPIC_API_KEY || env.OPENROUTER_API_KEY)) {
    console.warn(
      '[@repo/whatsapp-parser] no LLM key set — skipping parse, returning manual-review placeholder'
    );
    return { confidence: 0, rawNotes: rawText };
  }

  // Never throws; null on any failure. The `---` fence around the body is
  // trivially escaped, so the shape is enforced by the schema, not trusted.
  const validated = await callClaudeForObject<z.infer<typeof ParsedLeadSchema>>(
    {
      system: SYSTEM_PROMPT,
      user: `Extract the property lead from this WhatsApp message.\n\n---\n${rawText}\n---`,
      schema: ParsedLeadSchema,
      maxTokens: 1024,
      temperature: 0.2,
      model: CLAUDE_SONNET,
      feature: WHATSAPP_PARSE_FEATURE,
      attemptTimeoutMs: 30_000,
    }
  );
  if (!validated) {
    return { confidence: 0, rawNotes: rawText };
  }

  // Defensive: clamp confidence to [0, 1], default 0 if missing
  const confidence =
    typeof validated.confidence === 'number'
      ? Math.max(0, Math.min(1, validated.confidence))
      : 0;

  return { ...validated, confidence } as ParsedLead;
}
