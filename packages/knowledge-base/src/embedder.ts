
import { keys } from '../keys';

/**
 * Embedder — Voyage 3 preferred, OpenAI text-embedding-3-small fallback.
 *
 * Both branches normalise to a **1024-dim float vector** so we have ONE
 * `vector(1024)` Postgres column rather than branching schemas per model.
 * OpenAI is 1536-dim by default; we pass `dimensions: 1024` which is
 * officially supported on `text-embedding-3-small` (Matryoshka-style
 * dimension reduction, see OpenAI docs).
 *
 * If neither key is present, every function returns null. Callers MUST
 * handle null — we never silently degrade to lexical search.
 */

export const VOYAGE_MODEL = 'voyage-3';
export const OPENAI_MODEL = 'text-embedding-3-small';
export const EMBEDDING_DIMS = 1024;

export type EmbeddingModel = typeof VOYAGE_MODEL | typeof OPENAI_MODEL;

export type EmbeddingResult = {
  model: EmbeddingModel;
  vectors: number[][];
};

export type EmbedInputType = 'document' | 'query';

type ConfiguredProvider =
  | { kind: 'voyage'; apiKey: string }
  | { kind: 'openai'; apiKey: string }
  | { kind: 'none' };

function pickProvider(): ConfiguredProvider {
  const env = keys();
  if (env.VOYAGE_API_KEY) return { kind: 'voyage', apiKey: env.VOYAGE_API_KEY };
  if (env.OPENAI_API_KEY) return { kind: 'openai', apiKey: env.OPENAI_API_KEY };
  return { kind: 'none' };
}

/** Does the host have at least one embedding provider configured? */
export function isEmbeddingAvailable(): boolean {
  return pickProvider().kind !== 'none';
}

/** Which model would `embed()` use right now? null if no provider. */
export function activeEmbeddingModel(): EmbeddingModel | null {
  const p = pickProvider();
  if (p.kind === 'voyage') return VOYAGE_MODEL;
  if (p.kind === 'openai') return OPENAI_MODEL;
  return null;
}

async function callVoyage(
  apiKey: string,
  inputs: string[],
  inputType: EmbedInputType,
): Promise<number[][]> {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: VOYAGE_MODEL,
      input: inputs,
      input_type: inputType,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Voyage embed failed (${res.status}): ${text}`);
  }
  const json = (await res.json()) as {
    data: Array<{ embedding: number[]; index: number }>;
  };
  // Voyage doesn't guarantee return order matches input order — sort by index.
  const ordered = [...json.data].sort((a, b) => a.index - b.index);
  return ordered.map((d) => d.embedding);
}

async function callOpenAI(
  apiKey: string,
  inputs: string[],
): Promise<number[][]> {
  // We don't use input_type with OpenAI — they don't expose a doc/query
  // distinction. We DO request `dimensions: 1024` so the vector length
  // matches the Voyage branch and our pgvector column.
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: inputs,
      dimensions: EMBEDDING_DIMS,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI embed failed (${res.status}): ${text}`);
  }
  const json = (await res.json()) as {
    data: Array<{ embedding: number[]; index: number }>;
  };
  const ordered = [...json.data].sort((a, b) => a.index - b.index);
  return ordered.map((d) => d.embedding);
}

/**
 * Embed a batch of inputs. Returns null when no provider is configured.
 *
 * @param inputs — chunks at ingest time, single query at search time.
 * @param inputType — Voyage cares; OpenAI ignores. `'document'` for
 *   things we're storing, `'query'` for live search input.
 */
export async function embed(
  inputs: string[],
  inputType: EmbedInputType,
): Promise<EmbeddingResult | null> {
  if (inputs.length === 0) return { model: VOYAGE_MODEL, vectors: [] };

  const provider = pickProvider();
  if (provider.kind === 'none') return null;

  if (provider.kind === 'voyage') {
    const vectors = await callVoyage(provider.apiKey, inputs, inputType);
    return { model: VOYAGE_MODEL, vectors };
  }

  const vectors = await callOpenAI(provider.apiKey, inputs);
  return { model: OPENAI_MODEL, vectors };
}

/**
 * Convenience: embed a single string. Returns the raw vector or null.
 */
export async function embedOne(
  input: string,
  inputType: EmbedInputType,
): Promise<{ model: EmbeddingModel; vector: number[] } | null> {
  const result = await embed([input], inputType);
  if (!result || result.vectors.length === 0) return null;
  return { model: result.model, vector: result.vectors[0] };
}
