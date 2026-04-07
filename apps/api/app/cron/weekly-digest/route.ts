import { database } from '@repo/database';
import { log } from '@repo/observability/log';
import { sendWhatsAppMessage } from '@repo/whatsapp';
import { buildSummary } from '@repo/whatsapp/commands';
import { env } from '@/env';
import { subDays } from 'date-fns';

export const GET = async (request: Request): Promise<Response> => {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const since = subDays(new Date(), 7);
  const mappings = await database.phoneMapping.findMany();

  if (mappings.length === 0) {
    return Response.json({ sent: 0 });
  }

  let sent = 0;
  let skipped = 0;

  for (const mapping of mappings) {
    const entries = await database.journalEntry.findMany({
      where: { userId: mapping.userId, createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
      select: { content: true, createdAt: true },
    });

    if (entries.length === 0) {
      skipped++;
      continue;
    }

    try {
      const summary = await buildSummary(entries);
      await sendWhatsAppMessage(mapping.phoneNumber, summary);
      sent++;
    } catch (err) {
      log.error('Failed to send weekly digest', { err, userId: mapping.userId });
    }
  }

  log.info('Weekly digest complete', { sent, skipped });
  return Response.json({ sent, skipped });
};
