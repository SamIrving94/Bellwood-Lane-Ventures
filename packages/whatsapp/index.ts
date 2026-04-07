import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import twilio from 'twilio';
import { keys } from './keys';

export const JOURNAL_PROMPTS = [
  "How was your day? Share a moment that stood out.",
  "What's one thing you learned or accomplished today?",
  "What made you smile today?",
  "What's on your mind right now?",
  "Share a small win from today.",
  "What are you grateful for today?",
  "Describe your mood in a few words.",
  "What's one thing you'd do differently today?",
  "What was the highlight of your day?",
  "What are you looking forward to tomorrow?",
];

const WELCOME_MESSAGE = `Welcome to Microjournal! 📝

Here's how it works:
1. Send any text message to save a journal entry
2. Send a voice note to record a spoken entry (auto-transcribed)
3. Type /help anytime to see this message again

Your entries are saved and waiting for you at the web app. Happy journaling! ✨`;

export async function sendWhatsAppMessage(
  to: string,
  message: string
): Promise<void> {
  const env = keys();

  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_WHATSAPP_NUMBER) {
    throw new Error('Twilio environment variables are not configured');
  }

  const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);

  // Ensure the to number has whatsapp: prefix
  const toNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

  await client.messages.create({
    from: env.TWILIO_WHATSAPP_NUMBER,
    to: toNumber,
    body: message,
  });
}

export async function generatePersonalPrompt(
  recentEntries: { content: string }[]
): Promise<string> {
  const env = keys();
  if (!env.OPENAI_API_KEY || recentEntries.length === 0) {
    // Fallback to random prompt
    return JOURNAL_PROMPTS[Math.floor(Math.random() * JOURNAL_PROMPTS.length)];
  }

  try {
    const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
    const entriesText = recentEntries
      .slice(0, 5)
      .map((e, i) => `${i + 1}. ${e.content.slice(0, 200)}`)
      .join('\n');

    const { text } = await generateText({
      model: openai('gpt-4o-mini'),
      prompt: `You are a journaling companion. Based on these recent journal entries:\n\n${entriesText}\n\nWrite ONE short, personalised journaling prompt (1 sentence, under 120 characters). Reference themes from their entries. Be warm but not cheesy. Do not use quotes. Just the prompt text.`,
    });

    return text.trim() || JOURNAL_PROMPTS[Math.floor(Math.random() * JOURNAL_PROMPTS.length)];
  } catch {
    return JOURNAL_PROMPTS[Math.floor(Math.random() * JOURNAL_PROMPTS.length)];
  }
}

export async function sendJournalPrompt(
  to: string,
  recentEntries?: { content: string }[]
): Promise<void> {
  const prompt = recentEntries?.length
    ? await generatePersonalPrompt(recentEntries)
    : JOURNAL_PROMPTS[Math.floor(Math.random() * JOURNAL_PROMPTS.length)];
  return sendWhatsAppMessage(to, prompt);
}

export async function sendWelcomeMessage(to: string): Promise<void> {
  return sendWhatsAppMessage(to, WELCOME_MESSAGE);
}
