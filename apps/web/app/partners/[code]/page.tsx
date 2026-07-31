import { redirect } from 'next/navigation';
import { database } from '@repo/database';

export const dynamic = 'force-dynamic';

export default async function ReferralLandingPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const normalised = code.toUpperCase();

  // Check the referral code exists (best-effort)
  try {
    const agent = await database.agentAccount.findUnique({
      where: { referralCode: normalised },
      select: { id: true, firmName: true },
    });
    if (agent) {
      // Increment totalReferrals on click (lightweight — not per submission)
      await database.agentAccount.update({
        where: { id: agent.id },
        data: {},
      });
    }
  } catch {
    // Non-fatal — still redirect
  }

  // Redirect to instant-offer with the referral code attached
  redirect(`/instant-offer?ref=${normalised}`);
}
