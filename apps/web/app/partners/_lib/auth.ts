import 'server-only';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { database } from '@repo/database';

const COOKIE_NAME = 'bellwood-partner-session';
const MAGIC_LINK_TTL_MIN = 15;
const SESSION_TTL_DAYS = 30;

function getSecret(): string {
  return (
    process.env.PARTNER_AUTH_SECRET ||
    process.env.CRON_SECRET ||
    process.env.PAPERCLIP_API_KEY ||
    'bellwood-dev-partner-auth-secret-change-in-prod'
  );
}

function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('base64url');
}

function verify(payload: string, signature: string): boolean {
  const expected = sign(payload);
  if (expected.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

type TokenPayload = {
  sub: string; // agentAccountId
  kind: 'magic' | 'session';
  exp: number; // ms epoch
  nonce?: string;
};

function encodeToken(data: TokenPayload): string {
  const json = Buffer.from(JSON.stringify(data)).toString('base64url');
  const sig = sign(json);
  return `${json}.${sig}`;
}

function decodeToken(token: string): TokenPayload | null {
  const [json, sig] = token.split('.');
  if (!json || !sig) return null;
  if (!verify(json, sig)) return null;
  try {
    const data = JSON.parse(Buffer.from(json, 'base64url').toString()) as TokenPayload;
    if (!data.exp || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

// --------------------------------------------------------------------------
// Magic link
// --------------------------------------------------------------------------

export function createMagicLinkToken(agentAccountId: string): string {
  return encodeToken({
    sub: agentAccountId,
    kind: 'magic',
    exp: Date.now() + MAGIC_LINK_TTL_MIN * 60 * 1000,
    nonce: randomBytes(8).toString('hex'),
  });
}

export function verifyMagicLinkToken(token: string): string | null {
  const data = decodeToken(token);
  if (!data || data.kind !== 'magic') return null;
  return data.sub;
}

// --------------------------------------------------------------------------
// Session cookie
// --------------------------------------------------------------------------

export async function createSessionCookie(agentAccountId: string): Promise<void> {
  const token = encodeToken({
    sub: agentAccountId,
    kind: 'session',
    exp: Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getCurrentAgent(): Promise<
  | {
      id: string;
      email: string;
      contactName: string;
      firmName: string;
      referralCode: string;
      tier: string;
      totalReferrals: number;
      totalDeals: number;
    }
  | null
> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    const data = decodeToken(token);
    if (!data || data.kind !== 'session') return null;

    const agent = await database.agentAccount.findUnique({
      where: { id: data.sub },
      select: {
        id: true,
        email: true,
        contactName: true,
        firmName: true,
        referralCode: true,
        tier: true,
        totalReferrals: true,
        totalDeals: true,
      },
    });
    return agent;
  } catch {
    return null;
  }
}

// --------------------------------------------------------------------------
// Referral code
// --------------------------------------------------------------------------

export function generateReferralCode(firmName: string): string {
  const slug = firmName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4)
    .padEnd(4, 'X');
  const suffix = randomBytes(2).toString('hex').toUpperCase();
  return `${slug}${suffix}`;
}
