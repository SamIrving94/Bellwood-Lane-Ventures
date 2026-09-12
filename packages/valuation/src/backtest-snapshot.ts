/**
 * AVM snapshot — freeze every appraisal at decision time (backtest-snapshot.ts)
 *
 * The Sep 2026 review's first rule for a credible backtest: record what the
 * engine said, with what it knew, at the moment the number was used — then
 * judge it later against the property's real Land Registry sale. Nothing
 * here touches the database directly; `buildAvmSnapshot` is a pure mapping
 * from (input, result) to the row shape, and `saveAvmSnapshot` writes it
 * through whatever client the caller hands over (structurally typed, so this
 * package stays free of a database dependency and the helper is testable).
 *
 * A snapshot failure must NEVER break the appraisal it records, so
 * `saveAvmSnapshot` swallows and logs.
 */

import type { AvmInput, AvmResultPayload } from './index';

export type AvmSnapshotSource =
  | 'scout_lead'
  | 'deal'
  | 'quote'
  | 'batch'
  | 'backfill';

/** Which comparable-sales path produced the estimate. */
export type AvmCsaSource = 'distance' | 'hmlr' | 'synthetic';

/**
 * Plain JSON, spelled out so the row type satisfies Prisma's `InputJsonValue`
 * without this package importing Prisma.
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export interface AvmSnapshotRow {
  source: AvmSnapshotSource;
  sourceId: string | null;
  address: string;
  postcode: string;
  propertyType: string;
  sellerType: string | null;
  pointEstimatePence: number;
  lowPence: number | null;
  highPence: number | null;
  offerPence: number | null;
  confidenceLevel: string | null;
  comparableCount: number | null;
  csaSource: AvmCsaSource;
  engineVersion: string | null;
  evalConfigVersion: number | null;
  inputJson: JsonObject;
  resultJson: JsonObject;
}

/**
 * Parse the free-text `avmSources` label the engine emits (e.g.
 * `propertydata_sold_distance(4@0.25mi/2@0.5mi)+hpi`) into the coarse path.
 */
export function csaSourceFromLabel(
  label: string | null | undefined
): AvmCsaSource {
  if (!label) {
    return 'synthetic';
  }
  if (label.startsWith('propertydata_sold_distance')) {
    return 'distance';
  }
  if (label.startsWith('hmlr_ppd')) {
    return 'hmlr';
  }
  return 'synthetic';
}

/**
 * The deployed engine's identity. Vercel injects the commit sha at build
 * time; locally there is none, and "dev" is more honest than a guess.
 */
export function currentEngineVersion(): string {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  return sha ? sha.slice(0, 7) : 'dev';
}

const toPence = (pounds: number | null | undefined): number | null =>
  typeof pounds === 'number' && Number.isFinite(pounds)
    ? Math.round(pounds * 100)
    : null;

export function buildAvmSnapshot(args: {
  input: AvmInput;
  result: AvmResultPayload;
  source: AvmSnapshotSource;
  sourceId?: string | null;
  evalConfigVersion?: number | null;
  engineVersion?: string | null;
}): AvmSnapshotRow {
  const r = args.result.resultJson;
  // Strip the founder-tunable policy object from the frozen input — it is
  // identified by evalConfigVersion, and the raw object is large.
  const { offerConfig: _offerConfig, ...inputSansConfig } = args.input;
  return {
    source: args.source,
    sourceId: args.sourceId ?? null,
    address: (args.input.address ?? '').trim(),
    postcode: args.input.postcode.toUpperCase().trim(),
    propertyType: args.input.propertyType,
    sellerType: args.input.sellerType ?? null,
    pointEstimatePence: toPence(r.avmPointEstimate) ?? 0,
    lowPence: toPence(r.avmLow),
    highPence: toPence(r.avmHigh),
    offerPence: toPence(r.finalOffer),
    confidenceLevel: r.confidenceLevel ?? null,
    comparableCount:
      typeof r.comparableCount === 'number' ? r.comparableCount : null,
    csaSource: csaSourceFromLabel(r.avmSources),
    engineVersion: args.engineVersion ?? currentEngineVersion(),
    evalConfigVersion: args.evalConfigVersion ?? null,
    inputJson: inputSansConfig as unknown as JsonObject,
    resultJson: r as unknown as JsonObject,
  };
}

/** The slice of a Prisma client this helper needs — keeps the package DB-free. */
export interface AvmSnapshotWriter {
  avmSnapshot: {
    create: (args: { data: AvmSnapshotRow }) => Promise<unknown>;
  };
}

/**
 * Freeze one appraisal. Never throws: an appraisal that ran is worth more
 * than a perfect audit trail, so a write failure is logged and swallowed.
 * Skips rows with no point estimate (nothing to judge later).
 */
export async function saveAvmSnapshot(
  db: AvmSnapshotWriter,
  args: Parameters<typeof buildAvmSnapshot>[0]
): Promise<boolean> {
  try {
    const row = buildAvmSnapshot(args);
    if (row.pointEstimatePence <= 0) {
      return false;
    }
    await db.avmSnapshot.create({ data: row });
    return true;
  } catch (err) {
    console.warn(
      '[valuation/backtest-snapshot] failed to save snapshot (non-fatal)',
      err instanceof Error ? err.message : err
    );
    return false;
  }
}
