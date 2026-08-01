import 'server-only';

import { auth, currentUser } from '@clerk/nextjs/server';

/**
 * WHY THIS EXISTS
 * ---------------
 * Every server action and dashboard route used to gate on
 *   `const { userId } = await auth(); if (!userId) throw ...`
 * which only proves that *somebody* is signed in — not that they are allowed
 * to be here. Clerk sign-up is open, so any self-registered account could
 * dispatch vendor emails, mint investor access tokens, rewrite platform
 * config, override deal values and burn paid API credits.
 *
 * `requireFounder()` is the single authorisation gate for the founder
 * dashboard. Authentication ("is there a session?") and authorisation ("is
 * this session one of ours?") are decided in one place, so a new action
 * cannot ship with only half the check.
 *
 * RULES, IN ORDER
 * 1. No `userId` — not signed in — Unauthorized.
 * 2. `FOUNDER_USER_IDS` and/or `FOUNDER_EMAIL_ALLOWLIST` set: the session must
 *    match one of them (Clerk user id, or any email address on the account,
 *    compared case-insensitively). Both are comma-separated.
 * 3. Neither env var set: fall back to requiring Clerk organisation
 *    membership (`orgId`) — the same rule `app/actions/users/search.ts`
 *    already relies on. A bare self-signed-up account has no `orgId`, so this
 *    still fails closed, while a missing env var can never lock the founders
 *    out of their own dashboard.
 */

const parseList = (raw: string | undefined): string[] =>
  (raw ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

export type FounderSession = {
  userId: string;
  orgId: string | null;
};

/**
 * Non-throwing guard: the authorised session, or `null`. For route handlers
 * that need the caller's id but must answer with a 401 rather than throw.
 */
export const getFounderSession = async (): Promise<FounderSession | null> => {
  const { userId, orgId } = await auth();

  if (!userId) {
    return null;
  }

  const session: FounderSession = { userId, orgId: orgId ?? null };
  const allowedIds = parseList(process.env.FOUNDER_USER_IDS);
  const allowedEmails = parseList(process.env.FOUNDER_EMAIL_ALLOWLIST).map(
    (email) => email.toLowerCase()
  );

  // No allowlist configured — fall back to organisation membership.
  if (allowedIds.length === 0 && allowedEmails.length === 0) {
    if (!orgId) {
      // The likeliest cause of a founder being denied. Clerk organisations are
      // off by default on a template instance, so if nobody set the allowlist
      // this denies everyone, including us. Say so plainly: a generic "not
      // authorised" here would look like a Clerk problem and cost an hour.
      console.error(
        '[auth/requireFounder] DENIED: neither FOUNDER_USER_IDS nor FOUNDER_EMAIL_ALLOWLIST is set, and this session has no Clerk organisation. Set FOUNDER_USER_IDS to the founders\' Clerk user ids (Clerk dashboard, Users, copy the user_... id) to restore access.'
      );
    }
    return orgId ? session : null;
  }

  if (allowedIds.includes(userId)) {
    return session;
  }

  if (allowedEmails.length > 0) {
    const user = await currentUser();
    const matched = user?.emailAddresses.some((address) =>
      allowedEmails.includes(address.emailAddress.toLowerCase())
    );

    if (matched) {
      return session;
    }
  }

  return null;
};

/**
 * Throwing guard for server actions and route handlers. Returns the caller's
 * identity so callers can attribute writes without a second `auth()` round.
 */
export const requireFounder = async (): Promise<FounderSession> => {
  const session = await getFounderSession();

  if (!session) {
    throw new Error('Unauthorized');
  }

  return session;
};

/**
 * Non-throwing variant, for layouts/routes that need to render a "not
 * authorised" state or return a 401 rather than blow up with an error page.
 */
export const isFounder = async (): Promise<boolean> =>
  (await getFounderSession()) !== null;
