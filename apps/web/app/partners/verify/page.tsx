import { redirect } from 'next/navigation';
import { database } from '@repo/database';
import { createSessionCookie, verifyMagicLinkToken } from '../_lib/auth';

export const dynamic = 'force-dynamic';

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) {
    redirect('/partners/login?error=missing');
  }

  const agentId = verifyMagicLinkToken(token);
  if (!agentId) {
    redirect('/partners/login?error=expired');
  }

  // update lastLoginAt
  await database.agentAccount.update({
    where: { id: agentId },
    data: { lastLoginAt: new Date() },
  });

  await createSessionCookie(agentId);
  redirect('/portal');
}
