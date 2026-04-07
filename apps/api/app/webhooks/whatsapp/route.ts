import { database } from '@repo/database';
import { log } from '@repo/observability/log';
import { put } from '@repo/storage';
import { sendWelcomeMessage, sendWhatsAppMessage } from '@repo/whatsapp';
import {
  buildExportChunks,
  buildSummary,
  calculateStreak,
  formatStreakMessage,
} from '@repo/whatsapp/commands';
import { keys as whatsappKeys } from '@repo/whatsapp/keys';
import { transcribeAudio } from '@repo/whatsapp/transcribe';
import { subDays } from 'date-fns';
import twilio from 'twilio';

// ─── Duplicate prevention (in-memory, resets on cold start) ─────────────────
const processedMessages = new Set<string>();
const MAX_PROCESSED = 1000;

function isDuplicate(messageSid: string): boolean {
  if (processedMessages.has(messageSid)) return true;
  processedMessages.add(messageSid);
  // Prevent memory leak — trim oldest entries
  if (processedMessages.size > MAX_PROCESSED) {
    const first = processedMessages.values().next().value;
    if (first) processedMessages.delete(first);
  }
  return false;
}

// ─── Twilio signature verification ──────────────────────────────────────────
function verifyTwilioSignature(request: Request, params: URLSearchParams): boolean {
  const env = whatsappKeys();
  if (!env.TWILIO_AUTH_TOKEN) return false;

  const signature = request.headers.get('x-twilio-signature');
  if (!signature) return false;

  // Build the full URL Twilio used to sign
  const url = request.url;

  // Convert URLSearchParams to plain object for validation
  const paramsObj: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    paramsObj[key] = value;
  }

  return twilio.validateRequest(env.TWILIO_AUTH_TOKEN, signature, url, paramsObj);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getUserIdFromPhone(
  phoneNumber: string
): Promise<string | null> {
  const mapping = await database.phoneMapping.findUnique({
    where: { phoneNumber },
  });
  return mapping?.userId ?? null;
}

async function handleCommand(
  command: string,
  userId: string,
  from: string
): Promise<void> {
  switch (command) {
    case '/summary': {
      const since = subDays(new Date(), 7);
      const entries = await database.journalEntry.findMany({
        where: { userId, createdAt: { gte: since } },
        orderBy: { createdAt: 'asc' },
        select: { content: true, createdAt: true },
      });
      const summary = await buildSummary(entries);
      await sendWhatsAppMessage(from, summary);
      break;
    }

    case '/streak': {
      const [entries, prefs] = await Promise.all([
        database.journalEntry.findMany({
          where: { userId },
          select: { createdAt: true },
        }),
        database.userPreference.findUnique({
          where: { userId },
          select: { timezone: true },
        }),
      ]);
      const timezone = prefs?.timezone ?? 'UTC';
      const streak = calculateStreak(entries.map((e) => e.createdAt), timezone);
      await sendWhatsAppMessage(from, formatStreakMessage(streak));
      break;
    }

    case '/export': {
      const entries = await database.journalEntry.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: { content: true, createdAt: true },
      });
      const chunks = buildExportChunks(
        entries.map((e) => ({ content: e.content, createdAt: e.createdAt }))
      );
      for (const chunk of chunks) {
        await sendWhatsAppMessage(from, chunk);
      }
      break;
    }

    case '/help': {
      await sendWelcomeMessage(from);
      break;
    }

    default:
      break;
  }
}

// POST — incoming WhatsApp messages from Twilio
export async function POST(request: Request): Promise<Response> {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return new Response('OK', { status: 200 });
  }

  const params = new URLSearchParams(rawBody);

  // Verify Twilio signature in production (skip if no auth token for local dev)
  const env = whatsappKeys();
  if (env.TWILIO_AUTH_TOKEN) {
    const isValid = verifyTwilioSignature(request, params);
    if (!isValid) {
      log.warn('Invalid Twilio signature on webhook');
      return new Response('Forbidden', { status: 403 });
    }
  }

  // Duplicate prevention — skip if we've already processed this MessageSid
  const messageSid = params.get('MessageSid');
  if (messageSid && isDuplicate(messageSid)) {
    return new Response('OK', { status: 200 });
  }

  // Parse Twilio fields
  const from = params.get('From');
  const body = (params.get('Body') ?? '').trim();
  const numMedia = Number(params.get('NumMedia') ?? '0');
  const mediaUrl = params.get('MediaUrl0');
  const mediaContentType = params.get('MediaContentType0') ?? 'audio/ogg';

  if (!from) {
    return new Response('OK', { status: 200 });
  }

  // Strip "whatsapp:" prefix — store plain E.164 number e.g. "+447123456789"
  const phoneNumber = from.replace(/^whatsapp:/, '');

  const userId = await getUserIdFromPhone(phoneNumber);

  if (!userId) {
    await sendWelcomeMessage(phoneNumber).catch((err) =>
      log.error('Failed to send welcome message', { err })
    );
    return new Response('OK', { status: 200 });
  }

  // Handle commands
  if (body.startsWith('/')) {
    await handleCommand(body.toLowerCase(), userId, phoneNumber).catch((err) =>
      log.error('Command failed', { err, command: body })
    );
    return new Response('OK', { status: 200 });
  }

  // Handle voice/audio message
  if (numMedia > 0 && mediaUrl && mediaContentType.startsWith('audio')) {
    await transcribeAudio(mediaUrl, mediaContentType)
      .then((transcription) =>
        database.journalEntry.create({
          data: { userId, content: transcription, source: 'whatsapp' },
        })
      )
      .catch((err) => log.error('Failed to process voice message', { err }));
    return new Response('OK', { status: 200 });
  }

  // Handle image message
  if (numMedia > 0 && mediaUrl && mediaContentType.startsWith('image')) {
    try {
      // Download image from Twilio with auth
      const env = whatsappKeys();
      const authHeader = env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN
        ? `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64')}`
        : undefined;

      const imageRes = await fetch(mediaUrl, {
        headers: authHeader ? { Authorization: authHeader } : {},
      });

      if (imageRes.ok) {
        const imageBuffer = await imageRes.arrayBuffer();
        const ext = mediaContentType.split('/')[1] ?? 'jpg';
        const filename = `journal/${userId}/${Date.now()}.${ext}`;
        const blob = await put(filename, Buffer.from(imageBuffer), {
          access: 'public',
          contentType: mediaContentType,
        });

        await database.journalEntry.create({
          data: {
            userId,
            content: body || 'Photo entry',
            imageUrl: blob.url,
            source: 'whatsapp',
          },
        });
      }
    } catch (err) {
      log.error('Failed to process image message', { err });
    }
    return new Response('OK', { status: 200 });
  }

  // Handle plain text message
  if (body) {
    await database.journalEntry
      .create({
        data: { userId, content: body, source: 'whatsapp' },
      })
      .catch((err) => log.error('Failed to save text entry', { err }));
  }

  return new Response('OK', { status: 200 });
}
