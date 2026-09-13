import { type Prisma, database } from '@repo/database';
import { normaliseUkAddress } from '@repo/scouting';

/**
 * Entity-graph writers — the cross-source connection overlay.
 *
 * The graph is a read-only enrichment layer (see the schema comment on
 * GraphEntity): it records deterministic identities and observed
 * relationships so the lead detail page can surface "this company also
 * holds N other charged properties in your patch" — connections the
 * address-keyed ScoutLead dedup structurally cannot see. It NEVER feeds
 * scoring or gating.
 *
 * Every helper here is best-effort by contract: graph writes ride along
 * with lead persistence, and a graph failure (including the tables not yet
 * existing on prod) must never cost a lead. Callers wrap in try/catch.
 */

/**
 * Deterministic property identity: the address-normalise comparison key
 * ("houseNumber|street|postcode"), the same canonicalisation the pipeline
 * dedup uses — so a property is the same node no matter which source
 * observed it or how it spelled the street.
 */
export function propertyEntityKey(address: string, postcode: string): string {
  const normalised = normaliseUkAddress(`${address} ${postcode}`);
  return normalised.key;
}

export async function upsertGraphEntity(options: {
  kind: 'company' | 'property' | 'person';
  canonicalKey: string;
  name: string;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  const { kind, canonicalKey, name, metadata } = options;
  const row = await database.graphEntity.upsert({
    where: { kind_canonicalKey: { kind, canonicalKey } },
    create: {
      kind,
      canonicalKey,
      name,
      metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
    // Keep the freshest name/metadata — sources improve on each other
    // (a stream event may carry the registered name the notice abbreviated).
    update: {
      name,
      ...(metadata ? { metadata: metadata as Prisma.InputJsonValue } : {}),
    },
    select: { id: true },
  });
  return row.id;
}

export async function recordGraphEdge(options: {
  fromId: string;
  toId: string;
  kind: 'charge_over' | 'insolvency' | 'lender_of' | 'appointed_over';
  /** Stable observation id (charge code, notice id) — part of the dedup key. */
  sourceRef: string;
  sourceTrail: string;
  observedAt: Date;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { fromId, toId, kind, sourceRef, sourceTrail, observedAt, metadata } =
    options;
  await database.graphEdge.upsert({
    where: {
      fromId_toId_kind_sourceRef: { fromId, toId, kind, sourceRef },
    },
    // Re-observing the same fact is a no-op — provenance stays first-seen.
    update: {},
    create: {
      fromId,
      toId,
      kind,
      sourceRef,
      sourceTrail,
      observedAt,
      metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

/**
 * Record one company→property relationship (plus the lender when known) in a
 * single call — the shape every charge-flavoured source produces.
 */
export async function recordChargeObservation(options: {
  companyNumber: string;
  companyName: string;
  address: string;
  postcode: string;
  lender: string | null;
  kind: 'charge_over' | 'insolvency';
  sourceRef: string;
  sourceTrail: string;
  observedAt: Date;
}): Promise<void> {
  const {
    companyNumber,
    companyName,
    address,
    postcode,
    lender,
    kind,
    sourceRef,
    sourceTrail,
    observedAt,
  } = options;

  const companyId = await upsertGraphEntity({
    kind: 'company',
    canonicalKey: companyNumber,
    name: companyName,
  });
  const propertyId = await upsertGraphEntity({
    kind: 'property',
    canonicalKey: propertyEntityKey(address, postcode),
    name: `${address}`.slice(0, 200),
    metadata: { postcode },
  });
  await recordGraphEdge({
    fromId: companyId,
    toId: propertyId,
    kind,
    sourceRef,
    sourceTrail,
    observedAt,
  });

  if (lender) {
    // Lenders are companies too, but rarely arrive with a company number —
    // key them by normalised name, scoped so they can never collide with a
    // numbered company row.
    const lenderId = await upsertGraphEntity({
      kind: 'company',
      canonicalKey: `lender:${lender.toLowerCase().replace(/\s+/g, ' ').trim()}`,
      name: lender,
    });
    await recordGraphEdge({
      fromId: lenderId,
      toId: companyId,
      kind: 'lender_of',
      sourceRef,
      sourceTrail,
      observedAt,
    });
  }
}

/**
 * What the graph already knows around a company — stamped onto stream-created
 * leads as rawPayload.graphContext, which is the measurement the overlay
 * trial runs on: "how often does the graph connect a new lead to something
 * we already knew?" is answerable with one query over this field.
 */
export async function graphContextForCompany(
  companyNumber: string,
  excludePropertyKey: string | null
): Promise<{ connections: number; relatedProperties: string[] } | null> {
  const company = await database.graphEntity.findUnique({
    where: {
      kind_canonicalKey: { kind: 'company', canonicalKey: companyNumber },
    },
    select: {
      edgesFrom: {
        select: {
          kind: true,
          to: { select: { kind: true, name: true, canonicalKey: true } },
        },
        take: 50,
      },
      edgesTo: { select: { id: true }, take: 50 },
    },
  });
  if (!company) return null;

  const relatedProperties = company.edgesFrom
    .filter(
      (e) =>
        e.to.kind === 'property' && e.to.canonicalKey !== excludePropertyKey
    )
    .map((e) => e.to.name)
    .slice(0, 10);

  return {
    connections: company.edgesFrom.length + company.edgesTo.length,
    relatedProperties,
  };
}
