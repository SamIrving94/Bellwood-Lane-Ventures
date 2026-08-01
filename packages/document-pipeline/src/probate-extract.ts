import 'server-only';

import { keys } from '../keys';
import { runMistralOcr, type MistralOcrResult } from './mistral-ocr';
import {
  emptyProbateExtract,
  type Citation,
  type CitedExecutor,
  type CitedPropertyAddress,
  type CitedValue,
  type GrantType,
  type ProbateExtract,
} from './types';

const env = keys();

/** Claude Sonnet model used for the Citations call. */
const CLAUDE_SONNET = 'claude-sonnet-4-5';

/** Anthropic API beta headers required for Files + Citations. */
const ANTHROPIC_BETA_HEADERS = 'files-api-2025-04-14,citations-2025-04-14';
const ANTHROPIC_VERSION = '2023-06-01';
const ANTHROPIC_API_BASE = 'https://api.anthropic.com';

/**
 * Input to the probate extract pipeline. Provide either:
 *   - a `pdfUrl` (we fetch it and upload to Anthropic Files / send to Mistral), or
 *   - `pdfBytes` directly (e.g. an upload), with an optional `filename`.
 */
export type ProbatePdfInput =
  | { pdfUrl: string; pdfBytes?: never; filename?: string }
  | { pdfBytes: ArrayBuffer | Uint8Array; pdfUrl?: never; filename?: string };

export interface ExtractOptions {
  /** Optional AbortSignal so callers can cancel the whole pipeline. */
  signal?: AbortSignal;
}

/**
 * Run the full probate-grant pipeline:
 *
 *   1. Fetch / accept the PDF
 *   2. (Optional) Mistral OCR for grounded markdown per page
 *   3. Upload PDF to Anthropic Files API (beta `files-api-2025-04-14`)
 *   4. Ask Claude Sonnet (beta `citations-2025-04-14`) for structured JSON
 *      with citation spans tied back to the source PDF
 *   5. Return a typed `ProbateExtract`
 *
 * Graceful: never throws. On any failure returns an `emptyProbateExtract`
 * with `errorReason` set. The caller can rely on `extract.confidence === 0`
 * meaning "fall back to manual review".
 */
export async function extractProbateFromPdf(
  input: ProbatePdfInput,
  opts: ExtractOptions = {},
): Promise<ProbateExtract> {
  // --- 0. Graceful key check ------------------------------------------------
  if (!env.ANTHROPIC_API_KEY) {
    console.warn(
      '[@repo/document-pipeline] no ANTHROPIC_API_KEY — returning empty extract',
    );
    return emptyProbateExtract('no_api_key');
  }

  // --- 1. Resolve PDF bytes --------------------------------------------------
  let pdfBytes: Uint8Array;
  let filename: string;
  try {
    const resolved = await resolvePdfInput(input, opts.signal);
    pdfBytes = resolved.bytes;
    filename = resolved.filename;
  } catch (err) {
    return emptyProbateExtract(
      `pdf_fetch_failed:${(err as Error)?.message ?? String(err)}`.slice(0, 200),
    );
  }

  // --- 2. Mistral OCR (optional, best-effort) -------------------------------
  let ocr: MistralOcrResult | null = null;
  if (env.MISTRAL_API_KEY) {
    try {
      ocr = await runMistralOcr(
        input.pdfUrl
          ? { kind: 'url', url: input.pdfUrl }
          : {
              kind: 'base64',
              base64: bytesToBase64(pdfBytes),
              filename,
            },
        { apiKey: env.MISTRAL_API_KEY, signal: opts.signal },
      );
    } catch (err) {
      console.warn(
        '[@repo/document-pipeline] Mistral OCR failed, continuing with PDF-only',
        err,
      );
      ocr = null;
    }
  }

  // --- 3. Upload PDF to Anthropic Files API ---------------------------------
  let fileId: string | null = null;
  try {
    fileId = await uploadPdfToAnthropic({
      apiKey: env.ANTHROPIC_API_KEY,
      bytes: pdfBytes,
      filename,
      signal: opts.signal,
    });
  } catch (err) {
    console.warn(
      '[@repo/document-pipeline] Anthropic Files upload failed, falling back to inline PDF',
      err,
    );
    fileId = null;
  }

  // --- 4. Ask Claude Sonnet with citations on -------------------------------
  try {
    return await callClaudeForProbateExtract({
      apiKey: env.ANTHROPIC_API_KEY,
      fileId,
      pdfBytes,
      filename,
      ocr,
      signal: opts.signal,
    });
  } catch (err) {
    console.error('[@repo/document-pipeline] Claude extract failed', err);
    return emptyProbateExtract(
      `claude_extract_failed:${(err as Error)?.message ?? String(err)}`.slice(
        0,
        200,
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// PDF resolution
// ---------------------------------------------------------------------------

async function resolvePdfInput(
  input: ProbatePdfInput,
  signal?: AbortSignal,
): Promise<{ bytes: Uint8Array; filename: string }> {
  if ('pdfBytes' in input && input.pdfBytes) {
    const bytes =
      input.pdfBytes instanceof Uint8Array
        ? input.pdfBytes
        : new Uint8Array(input.pdfBytes);
    return { bytes, filename: input.filename ?? 'probate.pdf' };
  }
  if ('pdfUrl' in input && input.pdfUrl) {
    const res = await fetch(input.pdfUrl, { signal });
    if (!res.ok) {
      throw new Error(`fetch ${input.pdfUrl} -> ${res.status}`);
    }
    const buf = await res.arrayBuffer();
    return {
      bytes: new Uint8Array(buf),
      filename:
        input.filename ?? deriveFilenameFromUrl(input.pdfUrl) ?? 'probate.pdf',
    };
  }
  throw new Error('no pdfUrl or pdfBytes provided');
}

function deriveFilenameFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const last = u.pathname.split('/').pop();
    if (!last) return null;
    return last.endsWith('.pdf') ? last : `${last}.pdf`;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Anthropic Files API (beta `files-api-2025-04-14`)
// ---------------------------------------------------------------------------

async function uploadPdfToAnthropic(args: {
  apiKey: string;
  bytes: Uint8Array;
  filename: string;
  signal?: AbortSignal;
}): Promise<string> {
  const form = new FormData();
  // Wrap bytes in a Blob so FormData treats it as a file part.
  const blob = new Blob([bytesToArrayBuffer(args.bytes)], {
    type: 'application/pdf',
  });
  form.append('file', blob, args.filename);

  const res = await fetch(`${ANTHROPIC_API_BASE}/v1/files`, {
    method: 'POST',
    headers: {
      'x-api-key': args.apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'anthropic-beta': ANTHROPIC_BETA_HEADERS,
    },
    body: form,
    signal: args.signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Anthropic Files upload failed: ${res.status} ${text.slice(0, 300)}`,
    );
  }
  const json = (await res.json()) as { id?: string };
  if (!json.id) {
    throw new Error('Anthropic Files upload returned no id');
  }
  return json.id;
}

// ---------------------------------------------------------------------------
// Claude Citations call
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a careful UK probate-grant document analyst. The user will give you a Grant of Probate (or Letters of Administration) PDF and you must extract structured fields.

Rules:
- Return ONLY a single JSON object, no prose, no markdown fences.
- For every field you populate, point at the EXACT supporting span from the document. The Anthropic citations API will attach citation metadata automatically to text blocks; in addition, include an "excerpt" string of up to 200 characters quoting the supporting text, and a 0-based "pageIndex".
- Money values are in PENCE (multiply pounds by 100, drop decimals on rounding).
- Dates are ISO YYYY-MM-DD.
- If a field is not present in the document, set it to null (or [] for arrays). Do NOT guess.
- grantType must be one of "probate" | "letters_of_administration" | "unknown".
- confidence is a float 0-1 reflecting how confident you are in the overall extract.

Schema (TypeScript):
{
  "deceasedName":         { "value": string, "citation": { "pageIndex": number, "excerpt": string } } | null,
  "dateOfDeath":          { "value": string, "citation": { "pageIndex": number, "excerpt": string } } | null,
  "dateOfGrant":          { "value": string, "citation": { "pageIndex": number, "excerpt": string } } | null,
  "grantType":            "probate" | "letters_of_administration" | "unknown",
  "executors":            Array<{ "name": string, "address"?: string, "citation": { "pageIndex": number, "excerpt": string } }>,
  "solicitorFirm":        { "value": string, "citation": { "pageIndex": number, "excerpt": string } } | null,
  "totalEstateGrossPence":{ "value": number, "citation": { "pageIndex": number, "excerpt": string } } | null,
  "totalEstateNetPence":  { "value": number, "citation": { "pageIndex": number, "excerpt": string } } | null,
  "propertyAddresses":    Array<{ "address": string, "postcode"?: string, "citation": { "pageIndex": number, "excerpt": string } }>,
  "ihtPaidIndicator":     { "value": boolean, "citation": { "pageIndex": number, "excerpt": string } } | null,
  "confidence":           number
}`;

interface ClaudeContentBlock {
  type: string;
  text?: string;
  citations?: Array<{
    type?: string;
    cited_text?: string;
    page_number?: number;
    start_page_number?: number;
    end_page_number?: number;
    start_char_index?: number;
    end_char_index?: number;
  }>;
}

interface ClaudeMessagesResponse {
  content?: ClaudeContentBlock[];
}

async function callClaudeForProbateExtract(args: {
  apiKey: string;
  fileId: string | null;
  pdfBytes: Uint8Array;
  filename: string;
  ocr: MistralOcrResult | null;
  signal?: AbortSignal;
}): Promise<ProbateExtract> {
  const userContent: Array<Record<string, unknown>> = [];

  // 1) Provide the source PDF as a document block, with citations enabled.
  if (args.fileId) {
    userContent.push({
      type: 'document',
      source: { type: 'file', file_id: args.fileId },
      citations: { enabled: true },
      title: 'Grant of Probate (source PDF)',
    });
  } else {
    userContent.push({
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: bytesToBase64(args.pdfBytes),
      },
      citations: { enabled: true },
      title: 'Grant of Probate (source PDF)',
    });
  }

  // 2) Optionally provide Mistral OCR markdown as a *plain-text* document so
  //    Claude can ground citations against per-page text too. This is purely
  //    additive — if Mistral failed we just skip it.
  if (args.ocr && args.ocr.pages.length > 0) {
    const ocrText = args.ocr.pages
      .map((p) => `# Page ${p.pageIndex + 1}\n\n${p.markdown}`)
      .join('\n\n---\n\n');
    userContent.push({
      type: 'document',
      source: { type: 'text', media_type: 'text/plain', data: ocrText },
      citations: { enabled: true },
      title: 'Mistral OCR markdown',
      context: 'Per-page OCR output. Use to disambiguate hard-to-read text.',
    });
  }

  // 3) The actual extraction instruction.
  userContent.push({
    type: 'text',
    text: 'Extract the probate-grant fields from the source PDF. Return only the JSON object described in the system prompt. Use the page numbers from the source PDF for citations.',
  });

  const body = {
    model: CLAUDE_SONNET,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    metadata: { user_id: 'probate_extract' },
    messages: [
      {
        role: 'user',
        content: userContent,
      },
    ],
  };

  const res = await fetch(`${ANTHROPIC_API_BASE}/v1/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': args.apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'anthropic-beta': ANTHROPIC_BETA_HEADERS,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: args.signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Claude messages failed: ${res.status} ${text.slice(0, 300)}`,
    );
  }

  const json = (await res.json()) as ClaudeMessagesResponse;
  return parseClaudeResponse(json);
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

/**
 * Concatenate all text blocks, extract the JSON object, and overlay any
 * Anthropic-provided citations onto fields whose excerpt strings match a
 * cited_text span. The model is asked to inline excerpt+pageIndex itself,
 * so this overlay is an additive correction — we trust API citations over
 * the model's own claim when they conflict.
 */
function parseClaudeResponse(resp: ClaudeMessagesResponse): ProbateExtract {
  const blocks = resp.content ?? [];
  const fullText = blocks
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text as string)
    .join('');

  const jsonObj = extractJson(fullText);
  if (!jsonObj) {
    return emptyProbateExtract('claude_no_json');
  }

  const extract = coerceExtract(jsonObj);

  // Gather all API-provided citations (text + page numbers) so we can
  // refine excerpts if the model under-specified them.
  const apiCitations: Citation[] = [];
  for (const b of blocks) {
    if (!Array.isArray(b.citations)) continue;
    for (const c of b.citations) {
      if (!c) continue;
      const page =
        typeof c.page_number === 'number'
          ? c.page_number
          : typeof c.start_page_number === 'number'
            ? c.start_page_number
            : null;
      const excerpt =
        typeof c.cited_text === 'string'
          ? c.cited_text.slice(0, 200)
          : '';
      if (page === null || !excerpt) continue;
      apiCitations.push({ pageIndex: Math.max(0, page - 1), excerpt });
    }
  }

  if (apiCitations.length > 0) {
    overlayApiCitations(extract, apiCitations);
  }

  return extract;
}

/** Best-effort JSON extractor: strips code fences and grabs first `{...}` block. */
function extractJson(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const candidate = fenced ? (fenced[1] ?? '') : trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

function coerceExtract(raw: Record<string, unknown>): ProbateExtract {
  const out = emptyProbateExtract();

  out.deceasedName = coerceCitedString(raw.deceasedName);
  out.dateOfDeath = coerceCitedString(raw.dateOfDeath);
  out.dateOfGrant = coerceCitedString(raw.dateOfGrant);
  out.grantType = coerceGrantType(raw.grantType);
  out.executors = coerceExecutors(raw.executors);
  out.solicitorFirm = coerceCitedString(raw.solicitorFirm);
  out.totalEstateGrossPence = coerceCitedNumber(raw.totalEstateGrossPence);
  out.totalEstateNetPence = coerceCitedNumber(raw.totalEstateNetPence);
  out.propertyAddresses = coercePropertyAddresses(raw.propertyAddresses);
  out.ihtPaidIndicator = coerceCitedBool(raw.ihtPaidIndicator);

  const conf =
    typeof raw.confidence === 'number'
      ? Math.max(0, Math.min(1, raw.confidence))
      : 0;
  out.confidence = conf;

  return out;
}

function coerceCitation(raw: unknown): Citation | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const pageIndex =
    typeof r.pageIndex === 'number'
      ? Math.max(0, Math.floor(r.pageIndex))
      : typeof r.page_index === 'number'
        ? Math.max(0, Math.floor(r.page_index as number))
        : 0;
  const excerpt =
    typeof r.excerpt === 'string'
      ? r.excerpt.slice(0, 200)
      : typeof r.text === 'string'
        ? (r.text as string).slice(0, 200)
        : '';
  if (!excerpt) return null;
  return { pageIndex, excerpt };
}

function coerceCitedString(raw: unknown): CitedValue<string> | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const value = typeof r.value === 'string' ? r.value.trim() : '';
  if (!value) return null;
  const citation = coerceCitation(r.citation);
  if (!citation) return null;
  return { value, citation };
}

function coerceCitedNumber(raw: unknown): CitedValue<number> | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const value =
    typeof r.value === 'number' && Number.isFinite(r.value)
      ? Math.round(r.value)
      : null;
  if (value === null) return null;
  const citation = coerceCitation(r.citation);
  if (!citation) return null;
  return { value, citation };
}

function coerceCitedBool(raw: unknown): CitedValue<boolean> | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.value !== 'boolean') return null;
  const citation = coerceCitation(r.citation);
  if (!citation) return null;
  return { value: r.value, citation };
}

function coerceGrantType(raw: unknown): GrantType {
  if (raw === 'probate' || raw === 'letters_of_administration') return raw;
  return 'unknown';
}

function coerceExecutors(raw: unknown): CitedExecutor[] {
  if (!Array.isArray(raw)) return [];
  const out: CitedExecutor[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const name = typeof e.name === 'string' ? e.name.trim() : '';
    if (!name) continue;
    const citation = coerceCitation(e.citation);
    if (!citation) continue;
    out.push({
      name,
      ...(typeof e.address === 'string' && e.address.trim()
        ? { address: e.address.trim() }
        : {}),
      citation,
    });
  }
  return out;
}

function coercePropertyAddresses(raw: unknown): CitedPropertyAddress[] {
  if (!Array.isArray(raw)) return [];
  const out: CitedPropertyAddress[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const address = typeof e.address === 'string' ? e.address.trim() : '';
    if (!address) continue;
    const citation = coerceCitation(e.citation);
    if (!citation) continue;
    out.push({
      address,
      ...(typeof e.postcode === 'string' && e.postcode.trim()
        ? { postcode: e.postcode.trim().toUpperCase() }
        : {}),
      citation,
    });
  }
  return out;
}

/**
 * If the Anthropic citations API attached cited spans to text blocks,
 * overlay them onto extract fields whose excerpt is a substring of the
 * API-cited text (or vice-versa). Only used to refine page numbers; we
 * never invent fields the model didn't produce.
 */
function overlayApiCitations(
  extract: ProbateExtract,
  apiCitations: Citation[],
): void {
  const refine = (c: Citation): Citation => {
    const match = apiCitations.find(
      (api) =>
        api.excerpt.includes(c.excerpt) || c.excerpt.includes(api.excerpt),
    );
    if (!match) return c;
    return { pageIndex: match.pageIndex, excerpt: c.excerpt || match.excerpt };
  };

  const refineCitedValue = <T>(v: CitedValue<T> | null): CitedValue<T> | null =>
    v ? { value: v.value, citation: refine(v.citation) } : null;

  extract.deceasedName = refineCitedValue(extract.deceasedName);
  extract.dateOfDeath = refineCitedValue(extract.dateOfDeath);
  extract.dateOfGrant = refineCitedValue(extract.dateOfGrant);
  extract.solicitorFirm = refineCitedValue(extract.solicitorFirm);
  extract.totalEstateGrossPence = refineCitedValue(
    extract.totalEstateGrossPence,
  );
  extract.totalEstateNetPence = refineCitedValue(extract.totalEstateNetPence);
  extract.ihtPaidIndicator = refineCitedValue(extract.ihtPaidIndicator);
  extract.executors = extract.executors.map((e) => ({
    ...e,
    citation: refine(e.citation),
  }));
  extract.propertyAddresses = extract.propertyAddresses.map((p) => ({
    ...p,
    citation: refine(p.citation),
  }));
}

// ---------------------------------------------------------------------------
// Small encoding helpers (Node 20 + edge runtime safe)
// ---------------------------------------------------------------------------

function bytesToBase64(bytes: Uint8Array): string {
  // We're server-only, so Node's Buffer is always present. Base64-via-Buffer
  // is faster and avoids the chunked btoa(String.fromCharCode(...)) dance.
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  // Defensive fallback for edge-runtime callers that may import this module.
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(
      ...bytes.subarray(i, Math.min(i + chunk, bytes.length)),
    );
  }
  return btoa(binary);
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  // Slice into a brand-new ArrayBuffer so callers can't mutate ours through
  // the Blob view (and to drop any SharedArrayBuffer typing).
  const out = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(out).set(bytes);
  return out;
}
