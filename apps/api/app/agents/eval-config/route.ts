import { database } from '@repo/database';
import { NextResponse } from 'next/server';
import { validateAgentAuth, unauthorizedResponse } from '../_lib/auth';

// Returns the currently active eval configs for all eval types.
// Agents call this at the start of each run to get the correct weights/thresholds.
// Falls back to null for any type that has no active config yet.
//
// Intent: Give agents a single, authoritative source of scoring parameters.
// Expected output: { version: number, configs: Record<EvalType, object | null> }
// Failure modes: DB unreachable → 500 (agent should use hardcoded defaults)
export const GET = async (request: Request) => {
  if (!validateAgentAuth(request)) return unauthorizedResponse();

  const activeConfigs = await database.evalConfig.findMany({
    where: { activatedAt: { not: null } },
    orderBy: [{ evalType: 'asc' }, { version: 'desc' }],
    select: {
      evalType: true,
      version: true,
      config: true,
      description: true,
      activatedAt: true,
    },
  });

  // Return the highest active version for each eval type
  const byType = new Map<string, (typeof activeConfigs)[0]>();
  for (const c of activeConfigs) {
    if (!byType.has(c.evalType)) {
      byType.set(c.evalType, c);
    }
  }

  const evalTypes = ['lead_scoring', 'avm_confidence', 'outreach_quality', 'deal_quality'] as const;

  const configs: Record<string, { version: number; config: unknown; description: string | null; activatedAt: Date } | null> = {};
  for (const t of evalTypes) {
    const match = byType.get(t);
    configs[t] = match
      ? { version: match.version, config: match.config, description: match.description, activatedAt: match.activatedAt! }
      : null;
  }

  return NextResponse.json({ configs });
};
