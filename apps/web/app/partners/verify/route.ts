import { NextResponse } from 'next/server';
import { database } from '@repo/database';
import { createSessionCookie, verifyMagicLinkToken } from '../_lib/auth';

// Route handler (not a page) — cookies can only be mutated here in Next 15.

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const base = `${url.protocol}//${url.host}`;

  if (!token) {
    return NextResponse.redirect(`${base}/partners/login?error=missing`);
  }

  const agentId = verifyMagicLinkToken(token);
  if (!agentId) {
    return NextResponse.redirect(`${base}/partners/login?error=expired`);
  }

  try {
    await database.agentAccount.update({
      where: { id: agentId },
      data: { lastLoginAt: new Date() },
    });
  } catch {
    return NextResponse.redirect(`${base}/partners/login?error=expired`);
  }

  await createSessionCookie(agentId);
  return NextResponse.redirect(`${base}/portal`);
}
