import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { keys } from './keys';

// ─── Types ───────────────────────────────────────────────────────────────────

type Entry = {
  content: string;
  createdAt: Date;
};

// ─── /summary ────────────────────────────────────────────────────────────────

export async function buildSummary(entries: Entry[]): Promise<string> {
  if (entries.length === 0) {
    return "You haven't written any entries in the last 7 days. Send me a message to start! 📝";
  }

  const env = keys();
  if (!env.OPENAI_API_KEY) {
    // Fallback if no OpenAI key — just count entries
    return `You wrote ${entries.length} journal entr${entries.length === 1 ? 'y' : 'ies'} this week. Keep it up! 🌟`;
  }

  const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });

  const entriesText = entries
    .map((e, i) => `Entry ${i + 1}: ${e.content}`)
    .join('\n\n');

  const { text } = await generateText({
    model: openai('gpt-4o-mini'),
    prompt: `You are a warm, encouraging journaling companion. Here are someone's journal entries from the past week:\n\n${entriesText}\n\nWrite a short, friendly summary (3-4 sentences max) of their week. Highlight key themes, progress, or emotions. Be supportive and personal. Don't use bullet points.`,
  });

  return `📖 *Your week in review:*\n\n${text}`;
}

// ─── /streak ─────────────────────────────────────────────────────────────────

function dateToLocalString(date: Date, timezone: string): string {
  try {
    // Format as YYYY-MM-DD in the user's timezone
    return date.toLocaleDateString('en-CA', { timeZone: timezone });
  } catch {
    return date.toISOString().split('T')[0];
  }
}

export function calculateStreak(
  entryDates: Date[],
  timezone = 'UTC'
): number {
  if (entryDates.length === 0) return 0;

  // Get unique calendar dates in the user's timezone
  const uniqueDates = new Set(
    entryDates.map((d) => dateToLocalString(d, timezone))
  );

  let streak = 0;
  const today = new Date();

  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = dateToLocalString(d, timezone);

    if (uniqueDates.has(key)) {
      streak++;
    } else {
      // Allow missing today (day not over yet) on the first iteration
      if (i === 0) continue;
      break;
    }
  }

  return streak;
}

export function formatStreakMessage(streak: number): string {
  if (streak === 0) {
    return "You haven't journaled recently. Reply with anything to start your streak! 📝";
  }
  if (streak === 1) {
    return '🔥 You\'re on a 1-day streak! Come back tomorrow to keep it going.';
  }
  if (streak < 7) {
    return `🔥 ${streak}-day streak! You're building a great habit.`;
  }
  if (streak < 30) {
    return `🔥 *${streak}-day streak!* That's incredible — you're on a roll!`;
  }
  return `🏆 *${streak}-day streak!* You're a journaling legend. Absolutely outstanding.`;
}

// ─── /export ─────────────────────────────────────────────────────────────────

const MAX_WHATSAPP_CHARS = 4000;

export function buildExportChunks(entries: Entry[]): string[] {
  if (entries.length === 0) {
    return ["You have no journal entries yet. Send a message to write your first one! 📝"];
  }

  const lines = entries.map((e) => {
    const date = e.createdAt.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    return `📅 ${date}\n${e.content}`;
  });

  const chunks: string[] = [];
  let current = `📚 *Your last ${entries.length} journal entr${entries.length === 1 ? 'y' : 'ies'}:*\n\n`;

  for (const line of lines) {
    const candidate = current + line + '\n\n';
    if (candidate.length > MAX_WHATSAPP_CHARS) {
      chunks.push(current.trim());
      current = line + '\n\n';
    } else {
      current = candidate;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}
