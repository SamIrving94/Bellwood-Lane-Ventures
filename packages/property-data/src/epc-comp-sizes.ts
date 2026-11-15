/**
 * Floor areas for a valuation's comps, from the free EPC register
 * (epc-comp-sizes.ts) — the size-led AVM's evidence (Oct 2026).
 *
 * The size pillar used to size comps from PropertyData /floor-areas, capped
 * at the subject postcode plus five comp postcodes to save credits. Most
 * comps went unsized: Flat 1, 24 Clarendon Rise had 2 of its 17. The EPC
 * register is free, so every comp can be looked up — 15 of those 17 had a
 * certificate. The hold-out test (209 real sales, 23 Oct 2026) only gains
 * when the comps are sized like this AND size leads the blend.
 *
 * STRICT MATCHING OR NOTHING: a comp takes a certificate only when the
 * certificate's address is the same home by `sameHome` (exact number, exact
 * flat, street word). Newest certificate wins. A comp with no match stays
 * unsized — it costs one data point in a median, a wrong size would poison
 * the rate.
 *
 * Never throws. A failed search or certificate is "no size" for that comp.
 */

import { getEpcCertificateByNumber, searchDomesticEpc } from './epc';
import { sameHome } from './uprn';

/** At most this many comps are looked up per valuation, nearest first. */
export const MAX_EPC_COMP_LOOKUPS = 40;
/** Parallel register calls — a valuation fans out, the register is shared. */
const CONCURRENCY = 6;

export interface EpcCompSizeInput {
  address: string | null;
  postcode: string | null;
  distanceMiles?: number | null;
}

/** One sized home, keyed for the size pillar's own matcher. */
export interface EpcSizedHome {
  /** The certificate's address (carries the house number). */
  address: string;
  floorAreaSqm: number;
  certificateNumber: string;
}

const normalisePostcode = (p: string | null | undefined) =>
  (p ?? '').toUpperCase().replace(/\s+/g, '');

async function pool<T>(items: T[], fn: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        await fn(items[i] as T);
      }
    })
  );
}

/**
 * EPC floor areas for the given comps, grouped by normalised postcode (no
 * spaces, upper case) — the shape the size pillar's matcher reads. One
 * register search per postcode, one certificate fetch per matched comp.
 */
export async function getEpcCompFloorAreas(
  comps: EpcCompSizeInput[]
): Promise<Map<string, EpcSizedHome[]>> {
  const out = new Map<string, EpcSizedHome[]>();
  try {
    const wanted = comps
      .filter((c) => c.address && c.postcode)
      .sort((a, b) => (a.distanceMiles ?? 0) - (b.distanceMiles ?? 0))
      .slice(0, MAX_EPC_COMP_LOOKUPS);

    const byPostcode = new Map<string, EpcCompSizeInput[]>();
    for (const c of wanted) {
      const key = normalisePostcode(c.postcode);
      byPostcode.set(key, [...(byPostcode.get(key) ?? []), c]);
    }

    await pool([...byPostcode.entries()], async ([key, group]) => {
      const rows = await searchDomesticEpc(group[0]?.postcode ?? key);
      const sized: EpcSizedHome[] = [];
      for (const comp of group) {
        const hits = rows
          .filter((r) => sameHome(comp.address as string, r.address))
          .sort((a, b) =>
            String(b.registrationDate ?? '').localeCompare(
              String(a.registrationDate ?? '')
            )
          );
        const newest = hits[0];
        if (!newest) continue;
        const cert = await getEpcCertificateByNumber(
          newest.certificateNumber,
          comp.postcode ?? ''
        );
        if (cert?.floorAreaSqm && cert.floorAreaSqm > 0) {
          sized.push({
            address: newest.address,
            floorAreaSqm: Math.round(cert.floorAreaSqm),
            certificateNumber: newest.certificateNumber,
          });
        }
      }
      if (sized.length > 0) out.set(key, sized);
    });
  } catch (err) {
    console.warn('[property-data/epc-comp-sizes] comp sizing failed', err);
  }
  return out;
}
