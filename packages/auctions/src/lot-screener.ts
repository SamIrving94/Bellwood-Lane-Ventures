/**
 * Property-photo vision screener.
 *
 * Given the public photos of a property (an auction lot OR a scouted lead's
 * estate-agent listing), ask Claude Sonnet to produce a structured condition
 * assessment. For auction lots the output is attached to
 * AuctionLot.visualAssessment so the appraiser can downgrade visibly-distressed
 * lots; for leads it pre-fills the deal-model condition so the founder doesn't
 * have to eyeball it. `screenAuctionLot` is the original auction-named entry
 * point and now delegates to the generic `screenPropertyCondition`.
 *
 * Routed through @repo/ai (callClaudeWithMeta with image parts) so vision
 * spend lands in LlmCallLog under feature `property_vision`, the model can
 * be overridden from Settings → AI models, and an empty balance on one
 * provider falls through to the next. Pick a VISION-CAPABLE model for this
 * feature (Claude tiers, moonshotai/kimi-k2.6, meta-llama/llama-4-maverick).
 */

import 'server-only';

import {
  CLAUDE_SONNET,
  callClaudeWithMeta,
  hasLlmProvider,
} from '@repo/ai/claude';
import { z } from 'zod';

import type { VisualAssessment, VisualCondition, VisualFlag } from './types';

const MODEL = CLAUDE_SONNET;
const FEATURE = 'property_vision';
// Photos in, JSON out — vision calls are slow; give each provider a minute.
const ATTEMPT_TIMEOUT_MS = 60_000;
const MAX_PHOTOS = 10;
// Per-image fetch budget. Public auction CDNs are normally <1MB; cap at 5MB
// to avoid pathological responses (Anthropic also rejects images > ~5MB).
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_FETCH_TIMEOUT_MS = 8_000;

type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

type FetchedImage = {
  data: string;
  mediaType: ImageMediaType;
};

const VISUAL_CONDITIONS = [
  'pristine',
  'fair',
  'tired',
  'distressed',
  'derelict',
] as const satisfies readonly VisualCondition[];

const VISUAL_FLAGS = [
  'boarded_windows',
  'broken_windows',
  'roof_damage',
  'damp_visible',
  'fire_damage',
  'no_kitchen',
  'no_bathroom',
  'overgrown_garden',
  'squatting_signs',
  'structural_concern',
  'recent_refurb',
] as const satisfies readonly VisualFlag[];

const AssessmentSchema = z.object({
  conditionScore: z.number().min(0).max(10),
  condition: z.enum(VISUAL_CONDITIONS),
  flags: z.array(z.enum(VISUAL_FLAGS)),
  rationale: z.string().max(200),
  confidence: z.number().min(0).max(1),
});

const SYSTEM_PROMPT = `You are a chartered surveyor scoring UK residential property photos.

Property types: terraced houses, semi-detached, detached, flats. Photos come
from public auction catalogues (Auction House UK, Savills, Clive Emson) or
estate-agent listings, and are often a mix of exterior, kitchen, bathroom, and
living rooms. Vendors sometimes only publish exteriors for distressed stock —
be honest and lower your confidence when interiors are missing.

Output JSON ONLY matching this schema:
{
  "conditionScore": number,   // 0-10 (10 = pristine, 0 = derelict shell)
  "condition": "pristine" | "fair" | "tired" | "distressed" | "derelict",
  "flags": ("boarded_windows" | "broken_windows" | "roof_damage" |
            "damp_visible" | "fire_damage" | "no_kitchen" |
            "no_bathroom" | "overgrown_garden" | "squatting_signs" |
            "structural_concern" | "recent_refurb")[],
  "rationale": string,        // <= 200 chars, plain English
  "confidence": number        // 0-1, how sure you are
}

Rules:
- Map score → condition: 9-10 pristine, 7-8 fair, 5-6 tired, 3-4 distressed, 0-2 derelict.
- Only emit a flag if there is clear photo evidence. Do not guess.
- De-duplicate flags. Order is irrelevant.
- "recent_refurb" wins out — if you see a new kitchen/bathroom, score 7+.
- Rationale should mention the strongest visual evidence (1-2 features max).
- If photos are only exterior or look staged/generic, drop confidence below 0.5.
- Return JSON only. No prose, no markdown fences.`;

/**
 * Vision-screen a property's public photos (auction lot or estate-agent
 * listing) into a structured condition assessment.
 *
 * Graceful by design: returns `null` on missing API key, network error, or
 * schema-validation failure. NEVER throws.
 */
export async function screenPropertyCondition(input: {
  /** A label for logs (auction lot ref, lead id, etc.). */
  ref: string;
  address: string;
  photoUrls: string[];
}): Promise<VisualAssessment | null> {
  const { ref, address, photoUrls } = input;

  if (!photoUrls || photoUrls.length === 0) {
    return null;
  }

  if (!hasLlmProvider()) {
    console.warn(
      '[@repo/auctions/lot-screener] no LLM provider key set — skipping vision screen for',
      ref
    );
    return null;
  }

  const sampledPhotos = samplePhotos(photoUrls, MAX_PHOTOS);

  // The installed @anthropic-ai/sdk (0.32.1) only accepts base64 image
  // sources — URL-source images were added in a later SDK. We fetch each
  // photo, validate the content-type, and inline it as base64. Any photo
  // that fails to fetch is dropped silently; we only proceed if at least
  // one image survived.
  const fetched = await fetchImages(sampledPhotos);
  if (fetched.length === 0) {
    console.warn(
      '[@repo/auctions/lot-screener] no images fetched successfully for',
      ref
    );
    return null;
  }

  const userText = `Ref: ${ref}\nAddress: ${address}\nPhotos provided: ${fetched.length} of ${photoUrls.length} available.\n\nAssess the property condition from these photos and return the JSON object.`;

  try {
    const result = await callClaudeWithMeta({
      system: SYSTEM_PROMPT,
      user: userText,
      images: fetched.map((img) => ({
        data: img.data,
        mediaType: img.mediaType,
      })),
      model: MODEL,
      feature: FEATURE,
      maxTokens: 600,
      temperature: 0.2,
      attemptTimeoutMs: ATTEMPT_TIMEOUT_MS,
    });

    if (!result.text) {
      console.warn(
        '[@repo/auctions/lot-screener] no text in response for',
        ref
      );
      return null;
    }

    const raw = extractJson(result.text);
    if (!raw) {
      console.warn(
        '[@repo/auctions/lot-screener] could not extract JSON for',
        ref
      );
      return null;
    }

    const parsed = AssessmentSchema.safeParse(raw);
    if (!parsed.success) {
      console.warn(
        '[@repo/auctions/lot-screener] schema validation failed for',
        ref,
        parsed.error.message
      );
      return null;
    }

    // De-duplicate flags (Set preserves insertion order in JS).
    const uniqueFlags = Array.from(new Set(parsed.data.flags));

    return {
      conditionScore: parsed.data.conditionScore,
      condition: parsed.data.condition,
      flags: uniqueFlags,
      rationale: parsed.data.rationale,
      photoCount: fetched.length,
      confidence: parsed.data.confidence,
      modelUsed: result.model,
    };
  } catch (err) {
    console.error(
      '[@repo/auctions/lot-screener] vision call failed for',
      ref,
      err
    );
    return null;
  }
}

/**
 * Back-compat entry point for the auction-scan path. Delegates to the generic
 * `screenPropertyCondition`; kept so existing callers that pass `lotRef` keep
 * working unchanged.
 */
export function screenAuctionLot(input: {
  lotRef: string;
  address: string;
  photoUrls: string[];
}): Promise<VisualAssessment | null> {
  return screenPropertyCondition({
    ref: input.lotRef,
    address: input.address,
    photoUrls: input.photoUrls,
  });
}

/**
 * Fetch every URL in parallel, returning only those that resolved to a
 * supported image type within the size budget. Failures are silent — the
 * caller decides what to do with an empty result.
 */
async function fetchImages(urls: string[]): Promise<FetchedImage[]> {
  const settled = await Promise.allSettled(urls.map(fetchSingleImage));
  const out: FetchedImage[] = [];
  for (const r of settled) {
    if (r.status === 'fulfilled' && r.value) out.push(r.value);
  }
  return out;
}

async function fetchSingleImage(url: string): Promise<FetchedImage | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const mediaType = normaliseMediaType(res.headers.get('content-type'));
    if (!mediaType) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength === 0 || buf.byteLength > MAX_IMAGE_BYTES) return null;
    const base64 = Buffer.from(buf).toString('base64');
    return { data: base64, mediaType };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function normaliseMediaType(raw: string | null): ImageMediaType | null {
  if (!raw) return null;
  const t = raw.split(';')[0]?.trim().toLowerCase();
  if (
    t === 'image/jpeg' ||
    t === 'image/png' ||
    t === 'image/gif' ||
    t === 'image/webp'
  ) {
    return t;
  }
  if (t === 'image/jpg') return 'image/jpeg';
  return null;
}

/**
 * Evenly sample up to `cap` photos from `urls`. Keeps first and last where
 * possible so we get a mix of exterior + interior shots.
 */
function samplePhotos(urls: string[], cap: number): string[] {
  if (urls.length <= cap) return urls.slice();
  const result: string[] = [];
  const step = (urls.length - 1) / (cap - 1);
  for (let i = 0; i < cap; i++) {
    const idx = Math.round(i * step);
    const url = urls[idx];
    if (url !== undefined) result.push(url);
  }
  return result;
}

// Tolerate stray prose / markdown fences in case the model ignores the
// "JSON only" directive.
function extractJson(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const candidate = fenced?.[1] ?? trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
}
