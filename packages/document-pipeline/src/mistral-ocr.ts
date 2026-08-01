import 'server-only';

/**
 * Minimal Mistral OCR client.
 *
 * Endpoint: POST https://api.mistral.ai/v1/ocr
 * Auth:     Authorization: Bearer ${MISTRAL_API_KEY}
 * Model:    mistral-ocr-latest (~$1/1000 pages, preserves tables + reading order)
 *
 * Docs (verify shape if/when reachable): https://docs.mistral.ai/api/#tag/ocr
 *
 * The request body shape `{ model, document: { type, ... } }` follows the
 * shape documented at the time of writing. The response is normalised into
 * a per-page array of markdown text. If Mistral changes the response shape
 * we tolerate it gracefully via best-effort key picks below.
 */

export interface MistralOcrPage {
  /** 0-based page index. */
  pageIndex: number;
  /** Page markdown text (preserves headings, lists, tables). */
  markdown: string;
}

export interface MistralOcrResult {
  pages: MistralOcrPage[];
  /** Total pages reported by the API (may differ from pages.length on huge docs). */
  pageCount: number;
}

/**
 * Document input — either a remote URL Mistral can fetch, or an inline
 * base64 PDF. The Mistral docs at time of writing use `document_url` and
 * `document_base64` discriminators; we accept either via a typed union.
 */
export type MistralOcrInput =
  | { kind: 'url'; url: string }
  | { kind: 'base64'; base64: string; filename?: string };

interface OcrRequestBody {
  model: string;
  document:
    | { type: 'document_url'; document_url: string }
    | { type: 'base64'; base64: string; filename?: string };
}

const MISTRAL_OCR_ENDPOINT = 'https://api.mistral.ai/v1/ocr';
const MISTRAL_OCR_MODEL = 'mistral-ocr-latest';

/**
 * Run a PDF through Mistral OCR. Throws on transport / auth errors; the
 * caller is expected to handle failure gracefully (see probate-extract.ts).
 */
export async function runMistralOcr(
  input: MistralOcrInput,
  opts: { apiKey: string; signal?: AbortSignal; model?: string } = {
    apiKey: '',
  },
): Promise<MistralOcrResult> {
  if (!opts.apiKey) {
    throw new Error('runMistralOcr called without an API key');
  }

  const document: OcrRequestBody['document'] =
    input.kind === 'url'
      ? { type: 'document_url', document_url: input.url }
      : {
          type: 'base64',
          base64: input.base64,
          ...(input.filename ? { filename: input.filename } : {}),
        };

  const body: OcrRequestBody = {
    model: opts.model ?? MISTRAL_OCR_MODEL,
    document,
  };

  const res = await fetch(MISTRAL_OCR_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Mistral OCR returned ${res.status}: ${text.slice(0, 400)}`,
    );
  }

  const json = (await res.json()) as unknown;
  return normaliseMistralResponse(json);
}

/**
 * Tolerate a few different shapes the Mistral API has used while the OCR
 * endpoint stabilises. We try the documented shape first, then fall back
 * to best-effort extraction.
 */
function normaliseMistralResponse(raw: unknown): MistralOcrResult {
  if (!raw || typeof raw !== 'object') {
    return { pages: [], pageCount: 0 };
  }
  const root = raw as Record<string, unknown>;

  // Shape A (documented): { pages: [{ index, markdown }], usage_info: { pages_processed } }
  const pagesRaw =
    (root.pages as unknown) ?? (root.documents as unknown) ?? null;
  const pages: MistralOcrPage[] = [];

  if (Array.isArray(pagesRaw)) {
    pagesRaw.forEach((entry, i) => {
      if (!entry || typeof entry !== 'object') return;
      const p = entry as Record<string, unknown>;
      const idx =
        typeof p.index === 'number'
          ? p.index
          : typeof p.page_index === 'number'
            ? (p.page_index as number)
            : typeof p.page === 'number'
              ? (p.page as number)
              : i;
      const markdown =
        typeof p.markdown === 'string'
          ? p.markdown
          : typeof p.text === 'string'
            ? (p.text as string)
            : typeof p.content === 'string'
              ? (p.content as string)
              : '';
      pages.push({ pageIndex: idx, markdown });
    });
  }

  const usage =
    (root.usage_info as Record<string, unknown> | undefined) ??
    (root.usage as Record<string, unknown> | undefined);
  const pageCount =
    typeof usage?.pages_processed === 'number'
      ? (usage.pages_processed as number)
      : pages.length;

  // Sort by pageIndex so callers always get a monotonically-increasing list.
  pages.sort((a, b) => a.pageIndex - b.pageIndex);

  return { pages, pageCount };
}
