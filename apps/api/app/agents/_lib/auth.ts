import { env } from '@/env';
import { NextResponse } from 'next/server';

/**
 * Validate that a request comes from a trusted Paperclip agent.
 * Agents authenticate via Bearer token in the Authorization header.
 *
 * Accepts BELLWOOD_API_KEY (preferred) or PAPERCLIP_API_KEY (legacy).
 * Both env vars hold the same static bearer value on the API server.
 * The legacy name is kept temporarily because Paperclip auto-injects an
 * unrelated PAPERCLIP_API_KEY (a JWT) into agent runtimes, which caused
 * heartbeat 401s — agents must use BELLWOOD_API_KEY going forward.
 * See docs/PAPERCLIP-SYNC-BRIEF.md §6.
 */
export function validateAgentAuth(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return false;
  const accepted: string[] = [];
  if (env.BELLWOOD_API_KEY) accepted.push(`Bearer ${env.BELLWOOD_API_KEY}`);
  if (env.PAPERCLIP_API_KEY) accepted.push(`Bearer ${env.PAPERCLIP_API_KEY}`);
  return accepted.some((expected) => expected === authHeader);
}

export function unauthorizedResponse() {
  return NextResponse.json(
    {
      error: 'Unauthorized',
      hint: 'Use the static Authorization: Bearer ${BELLWOOD_API_KEY} header. The Paperclip runtime auto-injects PAPERCLIP_API_KEY as a JWT which does NOT match this endpoint. If BELLWOOD_API_KEY is missing from your env, ask the founder to set it in ~/.paperclip/instances/<instance>/.env.',
      docs: 'https://github.com/SamIrving94/Bellwood-Lane-Ventures/blob/master/apps/api/app/agents/_lib/auth.ts',
    },
    { status: 401 },
  );
}
