import { database } from '@repo/database';
import { normaliseUkAddress } from '@repo/scouting';

/**
 * Connections — the entity-graph overlay, read-only by design.
 *
 * Surfaces what the cross-source graph knows around this lead: the company
 * behind it, the lender holding the charge, and the OTHER properties the
 * same company holds charges over — connections the address-keyed ScoutLead
 * table structurally cannot see (one row per property, dedup by address).
 *
 * Deliberately changes nothing about scoring or gating: this is the
 * "one extra panel in the review screen" trial from the Aug 2026 pipeline
 * review — watch whether it catches anything the flat pipeline missed
 * before considering any deeper role. Renders nothing when the graph has
 * nothing (or doesn't exist yet), so it's invisible until it earns a look.
 */

interface ConnectionRow {
  label: string;
  name: string;
  detail: string | null;
}

export async function ConnectionsPanel({
  address,
  postcode,
  rawPayload,
}: {
  address: string;
  postcode: string;
  rawPayload: Record<string, unknown>;
}) {
  // Deterministic keys only: company number from any company-flavoured
  // signal, plus this property's own normalised address key.
  const signal = (rawPayload.receivershipSignal ??
    rawPayload.chargeSignal ??
    rawPayload.insolvencySignal) as
    | { companyNumber?: string | null }
    | undefined;
  const companyNumber = signal?.companyNumber ?? null;
  const propertyKey = normaliseUkAddress(`${address} ${postcode}`).key;

  const rows: ConnectionRow[] = [];
  try {
    const entities = await database.graphEntity.findMany({
      where: {
        OR: [
          ...(companyNumber
            ? [{ kind: 'company', canonicalKey: companyNumber }]
            : []),
          { kind: 'property', canonicalKey: propertyKey },
        ],
      },
      include: {
        edgesFrom: {
          include: { to: true },
          orderBy: { observedAt: 'desc' },
          take: 25,
        },
        edgesTo: {
          include: { from: true },
          orderBy: { observedAt: 'desc' },
          take: 25,
        },
      },
    });

    const EDGE_LABELS: Record<string, string> = {
      charge_over: 'Charge over',
      insolvency: 'Insolvency — charge over',
      lender_of: 'Lender to',
      appointed_over: 'Appointed over',
    };

    const seen = new Set<string>();
    for (const entity of entities) {
      for (const edge of entity.edgesFrom) {
        // Skip the edge pointing at THIS property — the lead page already
        // is that fact; connections are what it links onward to.
        if (
          edge.to.kind === 'property' &&
          edge.to.canonicalKey === propertyKey
        ) {
          continue;
        }
        const key = `${edge.kind}:${edge.to.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({
          label: EDGE_LABELS[edge.kind] ?? edge.kind,
          name: edge.to.name,
          detail: edge.sourceTrail,
        });
      }
      for (const edge of entity.edgesTo) {
        const key = `in:${edge.kind}:${edge.from.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({
          label:
            edge.kind === 'lender_of'
              ? 'Lender'
              : (EDGE_LABELS[edge.kind] ?? edge.kind),
          name: edge.from.name,
          detail: edge.sourceTrail,
        });
      }
    }
  } catch {
    // Graph tables absent or unreachable — the overlay simply doesn't render.
    return null;
  }

  if (rows.length === 0) return null;

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-5">
      <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.18em]">
        Connections · cross-source graph
      </p>
      <p className="mt-2 text-muted-foreground text-xs">
        What we already know around this lead from other sources. Shown for
        review only — it does not change the score.
      </p>
      <ul className="mt-3 space-y-2">
        {rows.slice(0, 8).map((row) => (
          <li key={`${row.label}:${row.name}`} className="text-sm">
            <span className="font-medium text-indigo-900">{row.label}:</span>{' '}
            <span>{row.name}</span>
            {row.detail && (
              <span className="ml-1 text-muted-foreground text-xs">
                via {row.detail}
              </span>
            )}
          </li>
        ))}
      </ul>
      {rows.length > 8 && (
        <p className="mt-2 text-muted-foreground text-xs">
          +{rows.length - 8} more connection{rows.length - 8 === 1 ? '' : 's'}
        </p>
      )}
    </div>
  );
}
