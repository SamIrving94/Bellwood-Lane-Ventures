import Anthropic from '@anthropic-ai/sdk';
import { keys } from './keys';

const env = keys();

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

const MODEL = 'claude-sonnet-4-5';

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
 * Parse a raw WhatsApp message into a structured lead using Claude.
 *
 * Graceful: if ANTHROPIC_API_KEY is not set, returns { confidence: 0, rawNotes }
 * so callers can route the intake to manual review.
 */
export async function parseWhatsAppMessage(
  rawText: string
): Promise<ParsedLead> {
  if (!env.ANTHROPIC_API_KEY) {
    console.warn(
      '[@repo/whatsapp-parser] no ANTHROPIC_API_KEY set — skipping parse, returning manual-review placeholder'
    );
    return { confidence: 0, rawNotes: rawText };
  }

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Extract the property lead from this WhatsApp message. Return JSON only.\n\n---\n${rawText}\n---`,
        },
      ],
    });

    const textBlock = response.content.find((c) => c.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return { confidence: 0, rawNotes: rawText };
    }

    const parsed = extractJson(textBlock.text);
    if (!parsed) {
      return { confidence: 0, rawNotes: rawText };
    }

    // Defensive: clamp confidence to [0, 1], default 0 if missing
    const confidence =
      typeof parsed.confidence === 'number'
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0;

    return {
      ...parsed,
      confidence,
    } as ParsedLead;
  } catch (err) {
    console.error('[@repo/whatsapp-parser] Claude parse failed', err);
    return {
      confidence: 0,
      rawNotes: rawText,
    };
  }
}

// Some responses may have stray code fences or prose; tolerate gracefully.
function extractJson(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();

  // Strip ```json ... ``` fences if present
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const candidate = fenced ? fenced[1] : trimmed;

  // Find first { ... last }
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;

  const jsonStr = candidate.slice(start, end + 1);
  try {
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}
