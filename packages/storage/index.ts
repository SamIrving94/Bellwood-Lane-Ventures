import { type PutCommandOptions, put as blobPut } from '@vercel/blob';

export * from '@vercel/blob';

/**
 * Every upload in the repo goes through this `put`, not the SDK's own.
 *
 * Why a wrapper (Oct 2026): the uploads store is the public "Deal-plan"
 * store, connected to the projects with the `Deal_Blob` prefix. New stores
 * authenticate with Vercel OIDC plus a store ID and get no read-write
 * token, so the SDK has to be told which store to use. Passing `storeId`
 * also makes OIDC win over any stale `BLOB_READ_WRITE_TOKEN` left by an
 * older store.
 *
 * `addRandomSuffix: true` keeps the 0.x behaviour: v1+ defaults it to
 * false, which would make viewing photos and signed offer PDFs live at
 * guessable URLs (`viewings/<id>/<timestamp>.jpg`). A call site can still
 * override either option.
 */
export const put: typeof blobPut = (pathname, body, options) => {
  const storeId = process.env.Deal_Blob_STORE_ID?.trim();
  const defaults: Partial<PutCommandOptions> = {
    addRandomSuffix: true,
    ...(storeId ? { storeId } : {}),
  };
  return blobPut(pathname, body, { ...defaults, ...options });
};
