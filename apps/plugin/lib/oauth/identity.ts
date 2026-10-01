/**
 * Who may sign in to the Pro plugin. No new accounts: an email is let in only
 * if it already belongs to
 *  - an AgentAccount (partner estate agent, scope "agent"), or
 *  - a non-revoked InvestorAccessToken with that email (scope "investor").
 * Founders add or revoke people in the dashboard as today. Identity is
 * re-checked on every token refresh and every tool call, so a revoke takes
 * effect at once.
 */

import { database } from '@repo/database';
import type { Scope } from './config';

export interface ProIdentity {
  email: string;
  scopes: Scope[];
  agent: {
    id: string;
    contactName: string;
    firmName: string;
    phone: string | null;
    referralCode: string;
  } | null;
  investor: { id: string; label: string } | null;
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findIdentity(
  rawEmail: string
): Promise<ProIdentity | null> {
  const email = normaliseEmail(rawEmail);
  if (!email.includes('@') || email.length > 254) return null;

  const [agent, investor] = await Promise.all([
    database.agentAccount.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: {
        id: true,
        contactName: true,
        firmName: true,
        phone: true,
        referralCode: true,
      },
    }),
    database.investorAccessToken.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
        revoked: false,
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, label: true },
    }),
  ]);

  const scopes: Scope[] = [];
  if (agent) scopes.push('agent');
  if (investor) scopes.push('investor');
  if (scopes.length === 0) return null;
  return { email, scopes, agent, investor };
}
