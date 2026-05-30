
import { database } from '@repo/database';
import { embedOne, isEmbeddingAvailable } from './embedder';
import { toVectorLiteral } from './store';

/**
 * Vector similarity search over KnowledgeChunk.
 *
 * Uses pgvector's `<=>` cosine-distance operator. We expose `score` as
 * `1 - cosine_distance`, so 1.0 = perfect match, 0.0 = orthogonal. Most
 * useful chunks for our corpus come back in the 0.40–0.80 range; below
 * ~0.30 the chunks are usually unrelated and the caller should treat as
 * "no answer found".
 */

export type SearchResult = {
  path: string;
  headingTrail: string;
  excerpt: string;
  score: number;
};

const EXCERPT_CHARS = 200;

function excerpt(body: string): string {
  const trimmed = body.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= EXCERPT_CHARS) return trimmed;
  return `${trimmed.slice(0, EXCERPT_CHARS).trimEnd()}…`;
}

/**
 * Embed the query, run cosine-similarity top-k against the store.
 *
 * Returns null when no embedding provider is configured — the caller
 * (e.g. the concierge route) should turn this into a 503 with a clear
 * "set VOYAGE_API_KEY" message. We intentionally don't fall back to
 * lexical / LIKE search; if RAG isn't available, say so loudly.
 */
export async function searchKnowledge(
  query: string,
  k = 3,
): Promise<SearchResult[] | null> {
  if (!isEmbeddingAvailable()) return null;
  if (!query.trim()) return [];

  const embedded = await embedOne(query, 'query');
  if (!embedded) return null;

  const vec = toVectorLiteral(embedded.vector);
  const limit = Math.max(1, Math.min(k, 25));

  // `<=>` is cosine distance (0 = identical, 2 = opposite). We sort by
  // distance ASC and report similarity = 1 - distance for caller sanity.
  // We use $queryRawUnsafe so we can interpolate the vector literal +
  // `::vector` cast; `limit` is a number we've already clamped and
  // `sourcePath` etc. are returned columns, not user input — no
  // injection surface.
  const rows = await database.$queryRawUnsafe<
    Array<{
      sourcePath: string;
      headingTrail: string;
      body: string;
      score: number;
    }>
  >(
    `SELECT "sourcePath", "headingTrail", "body",
            1 - ("embedding" <=> '${vec}'::vector) as score
     FROM "KnowledgeChunk"
     ORDER BY "embedding" <=> '${vec}'::vector
     LIMIT ${limit}`,
  );

  return rows.map((r) => ({
    path: r.sourcePath,
    headingTrail: r.headingTrail,
    excerpt: excerpt(r.body),
    score: typeof r.score === 'number' ? r.score : Number(r.score),
  }));
}

/**
 * Like `searchKnowledge` but returns the FULL body of each chunk, not
 * just an excerpt. Use this when building the RAG prompt — the concierge
 * needs the full text to answer, while the API response only shows
 * excerpts so we don't dump huge blobs to the client.
 */
export async function searchKnowledgeFull(
  query: string,
  k = 3,
): Promise<
  | Array<{
      path: string;
      headingTrail: string;
      body: string;
      excerpt: string;
      score: number;
    }>
  | null
> {
  if (!isEmbeddingAvailable()) return null;
  if (!query.trim()) return [];

  const embedded = await embedOne(query, 'query');
  if (!embedded) return null;

  const vec = toVectorLiteral(embedded.vector);
  const limit = Math.max(1, Math.min(k, 25));

  const rows = await database.$queryRawUnsafe<
    Array<{
      sourcePath: string;
      headingTrail: string;
      body: string;
      score: number;
    }>
  >(
    `SELECT "sourcePath", "headingTrail", "body",
            1 - ("embedding" <=> '${vec}'::vector) as score
     FROM "KnowledgeChunk"
     ORDER BY "embedding" <=> '${vec}'::vector
     LIMIT ${limit}`,
  );

  return rows.map((r) => ({
    path: r.sourcePath,
    headingTrail: r.headingTrail,
    body: r.body,
    excerpt: excerpt(r.body),
    score: typeof r.score === 'number' ? r.score : Number(r.score),
  }));
}
