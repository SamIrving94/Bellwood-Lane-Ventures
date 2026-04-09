import { env } from '@/env';
import { NextResponse } from 'next/server';

/**
 * Validate that a request comes from a trusted Paperclip agent.
 * Agents authenticate via Bearer token in the Authorization header.
 */
export function validateAgentAuth(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${env.PAPERCLIP_API_KEY}`;
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
