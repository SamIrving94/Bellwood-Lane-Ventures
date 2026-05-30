
import { database } from '@repo/database';
import { createHash } from 'node:crypto';

/**
 * Persistence layer for KnowledgeChunk.
 *
 * Prisma can't talk to pgvector natively, so the schema treats `embedding`
 * as `Unsupported("vector(1024)")`. We round-trip it via raw SQL:
 *   - write: build the literal `'[0.1, 0.2, ...]'::vector` and INSERT
 *   - read: handled in search.ts via $queryRaw
 *
 * Idempotency: `contentHash` is SHA-256 of body. Re-ingesting a doc that
 * hasn't changed is a no-op — we look up the hash and skip the embed call
 * (which is the expensive bit, dollars-wise). When a doc DOES change, the
 * old chunks are deleted and the new ones inserted in one transaction so
 * search never sees a half-updated file.
 */

export type KnowledgeChunkRow = {
  id: string;
  sourcePath: string;
  headingTrail: string;
  body: string;
  embedding: number[];
  model: string;
  contentHash: string;
  updatedAt: Date;
};

export type ChunkInput = {
  sourcePath: string;
  headingTrail: string;
  body: string;
  embedding: number[];
  model: string;
};

/** SHA-256 of body — stable identifier of "this exact text". */
export function hashBody(body: string): string {
  return createHash('sha256').update(body, 'utf8').digest('hex');
}

/**
 * pgvector literal: `'[0.1,0.2,...]'`. The `::vector` cast happens in the
 * raw SQL where this string is interpolated.
 */
export function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(',')}]`;
}

/**
 * Wipe + reinsert all chunks for one source file in a single transaction.
 *
 * Why "delete + insert" and not "upsert per chunk": when a file is edited
 * the chunk boundaries change. Trying to diff chunks against the prior
 * version is more work than it's worth at this corpus size (<1000 chunks).
 */
export async function replaceChunksForSource(
  sourcePath: string,
  chunks: ChunkInput[],
): Promise<void> {
  await database.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      'DELETE FROM "KnowledgeChunk" WHERE "sourcePath" = $1',
      sourcePath,
    );
    for (const c of chunks) {
      const hash = hashBody(c.body);
      const vec = toVectorLiteral(c.embedding);
      // We have to use $executeRawUnsafe for the vector literal because
      // Prisma's tagged $executeRaw won't let us interpolate the `::vector`
      // cast cleanly. All values are explicitly passed as parameters
      // EXCEPT the vector literal itself, which is a pure-numeric string
      // we just built — no injection surface.
      await tx.$executeRawUnsafe(
        `INSERT INTO "KnowledgeChunk"
           ("id", "sourcePath", "headingTrail", "body", "embedding", "model", "contentHash", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, '${vec}'::vector, $4, $5, NOW())`,
        c.sourcePath,
        c.headingTrail,
        c.body,
        c.model,
        hash,
      );
    }
  });
}

/**
 * Returns the set of body-hashes currently stored for a source file.
 * Used by the ingest CLI to skip re-embedding unchanged files.
 */
export async function existingHashesForSource(
  sourcePath: string,
): Promise<Set<string>> {
  const rows = await database.$queryRawUnsafe<Array<{ contentHash: string }>>(
    'SELECT "contentHash" FROM "KnowledgeChunk" WHERE "sourcePath" = $1',
    sourcePath,
  );
  return new Set(rows.map((r) => r.contentHash));
}

/** Drop every chunk from a source file (used when a file is deleted). */
export async function deleteChunksForSource(sourcePath: string): Promise<void> {
  await database.$executeRawUnsafe(
    'DELETE FROM "KnowledgeChunk" WHERE "sourcePath" = $1',
    sourcePath,
  );
}

/** Total chunk count — used by health check + ingest summary. */
export async function countChunks(): Promise<number> {
  const rows = await database.$queryRawUnsafe<Array<{ count: bigint }>>(
    'SELECT COUNT(*)::bigint as count FROM "KnowledgeChunk"',
  );
  return Number(rows[0]?.count ?? 0n);
}
