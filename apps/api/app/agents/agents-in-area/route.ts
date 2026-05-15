import { getAgentsByPostcode } from '@repo/property-data/src/propertydata';
import { NextResponse } from 'next/server';
import { validateAgentAuth, unauthorizedResponse } from '../_lib/auth';

/**
 * GET /agents/agents-in-area?postcode=M14&limit=10
 *
 * Estate-agent intelligence for the area, ranked by active listing volume.
 * Paperclip Marketer uses this to prioritise outreach — small/medium agents
 * who'd value our certainty-of-completion get hit first; the big chains
 * (Connells, Purplebricks etc) are deprioritised because they don't.
 *
 * Cached upstream at the PropertyData wrapper layer (7-day cache).
 */
export const GET = async (request: Request) => {
  if (!validateAgentAuth(request)) return unauthorizedResponse();

  const url = new URL(request.url);
  const postcode = url.searchParams.get('postcode');
  if (!postcode || !postcode.trim()) {
    return NextResponse.json(
      { error: 'postcode query param required' },
      { status: 400 },
    );
  }
  const limit = Math.max(
    1,
    Math.min(50, Number(url.searchParams.get('limit') ?? '15')),
  );

  try {
    const data = await getAgentsByPostcode(postcode.trim());
    const agents =
      (data as { result?: { agents?: unknown[] } } | null)?.result?.agents ?? [];

    type Row = {
      name: string;
      phone: string | null;
      address: string | null;
      numberOfListings: number;
      url: string | null;
      priorityScore: number;
      priorityReason: string;
    };

    const rows: Row[] = [];
    for (const raw of agents) {
      if (!raw || typeof raw !== 'object') continue;
      const a = raw as Record<string, unknown>;
      const name = typeof a.name === 'string' ? a.name.trim() : null;
      if (!name) continue;
      const numberOfListings =
        typeof a.number_of_listings === 'number' ? a.number_of_listings : 0;

      // Priority heuristic: small/medium independents get higher scores
      // than national chains. National chain detection is name-based.
      const lower = name.toLowerCase();
      const isNationalChain =
        /\b(connells|purplebricks|yopa|countrywide|hunters|reeds rains|spicerhaart|haart|leaders|romans|martin\s?&\s?co|chestertons|fox\s?&\s?sons|northwood|belvoir|barnard\s?marcus|foxtons|knight frank|savills|carter jonas|hamptons)\b/.test(
          lower,
        );

      let priorityScore = 50;
      let priorityReason = 'mid-market independent';
      if (isNationalChain) {
        priorityScore -= 30;
        priorityReason = 'national chain — typically low SLA value';
      }
      if (numberOfListings >= 2 && numberOfListings <= 30) {
        priorityScore += 20;
        priorityReason = 'small-volume independent — high SLA value';
      } else if (numberOfListings > 80) {
        priorityScore -= 10;
        priorityReason = 'high-volume agent — slower to triage cash buyers';
      }

      rows.push({
        name,
        phone: typeof a.phone === 'string' ? a.phone : null,
        address: typeof a.address === 'string' ? a.address : null,
        numberOfListings,
        url: typeof a.url === 'string' ? a.url : null,
        priorityScore,
        priorityReason,
      });
    }

    // Sort by priorityScore desc, then by listing count desc
    rows.sort((a, b) => {
      if (b.priorityScore !== a.priorityScore)
        return b.priorityScore - a.priorityScore;
      return b.numberOfListings - a.numberOfListings;
    });

    return NextResponse.json({
      ok: true,
      postcode: postcode.trim(),
      count: rows.length,
      agents: rows.slice(0, limit),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
};
