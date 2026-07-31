
/**
 * @repo/knowledge-base — embeddings + RAG over docs/*.md.
 *
 * Public surface:
 *   - searchKnowledge(query, k)       — top-k chunks + score
 *   - searchKnowledgeFull(query, k)   — same, plus full body for prompts
 *   - ingest(opts)                    — one-shot ingester (used by bin/)
 *   - isEmbeddingAvailable()          — true iff at least one provider key is set
 *   - activeEmbeddingModel()          — which model embed() would use
 *
 */

export {
  searchKnowledge,
  searchKnowledgeFull,
  type SearchResult,
} from './search';
export {
  embed,
  embedOne,
  isEmbeddingAvailable,
  activeEmbeddingModel,
  EMBEDDING_DIMS,
  VOYAGE_MODEL,
  OPENAI_MODEL,
  type EmbeddingModel,
  type EmbeddingResult,
  type EmbedInputType,
} from './embedder';
export { ingest, type IngestStats, type IngestOptions } from './ingest';
export { chunkMarkdown, estimateTokens, type Chunk } from './chunker';
export {
  countChunks,
  hashBody,
  deleteChunksForSource,
  type KnowledgeChunkRow,
} from './store';
