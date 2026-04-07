import { database } from '@repo/database';
import { log } from '@repo/observability/log';
import { sendJournalPrompt } from '@repo/whatsapp';
import { env } from '@/env';

function getCurrentHourInTimezone(timezone: string): number {
  try {
    const hourStr = new Date().toLocaleString('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    });
    // toLocaleString with hour12:false returns "24" for midnight in some locales
    const h = Number(hourStr);
    return h === 24 ? 0 : h;
  } catch {
    // Unknown timezone — fall back to UTC hour
    return new Date().getUTCHours();
  }
}

export const GET = async (request: Request): Promise<Response> => {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Get all phone mappings with their user preferences
  const mappings = await database.phoneMapping.findMany();

  if (mappings.length === 0) {
    return Response.json({ sent: 0, skipped: 0 });
  }

  // Load all preferences in one query
  const userIds = mappings.map((m) => m.userId);
  const preferences = await database.userPreference.findMany({
    where: { userId: { in: userIds } },
  });
  const prefsMap = new Map(preferences.map((p) => [p.userId, p]));

  const currentUTCHour = new Date().getUTCHours();
  log.info('Daily prompts cron running', { utcHour: currentUTCHour });

  const toSend: { phoneNumber: string; userId: string }[] = [];

  for (const mapping of mappings) {
    const pref = prefsMap.get(mapping.userId);
    const promptHour = pref?.promptHour ?? 18;
    const timezone = pref?.timezone ?? 'UTC';

    const userCurrentHour = getCurrentHourInTimezone(timezone);

    if (userCurrentHour === promptHour) {
      toSend.push({ phoneNumber: mapping.phoneNumber, userId: mapping.userId });
    }
  }

  if (toSend.length === 0) {
    return Response.json({ sent: 0, skipped: mappings.length });
  }

  // Fetch recent entries for personalised prompts
  const recentEntriesMap = new Map<string, { content: string }[]>();
  const allUserIds = toSend.map((s) => s.userId);
  const recentEntries = await database.journalEntry.findMany({
    where: { userId: { in: allUserIds } },
    select: { userId: true, content: true },
    orderBy: { createdAt: 'desc' },
    take: allUserIds.length * 5,
  });

  for (const entry of recentEntries) {
    const list = recentEntriesMap.get(entry.userId) ?? [];
    if (list.length < 5) {
      list.push({ content: entry.content });
      recentEntriesMap.set(entry.userId, list);
    }
  }

  const results = await Promise.allSettled(
    toSend.map(({ phoneNumber, userId }) =>
      sendJournalPrompt(phoneNumber, recentEntriesMap.get(userId))
    )
  );

  const sent = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  if (failed > 0) {
    log.warn('Some daily prompts failed to send', { sent, failed });
  }

  log.info('Daily prompts sent', { sent, failed, skipped: mappings.length - toSend.length });

  return Response.json({ sent, failed, skipped: mappings.length - toSend.length });
};
