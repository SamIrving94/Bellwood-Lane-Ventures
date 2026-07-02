import { API_BASE, env } from '../client';
import { logCreditUsage } from '../credits';

// Endpoint: /george — PropertyData's AI research assistant (POST)
// ---------------------------------------------------------------------------

export type GeorgeMessage = { role: 'user' | 'assistant'; content: string };

/**
 * Pull a string answer out of whatever shape PropertyData /george returns.
 * Their docs don't pin it down so we try the most likely paths in order.
 * Falls back to JSON-stringifying the whole response if nothing matches —
 * the user gets *something* useful while we discover the real shape.
 */
function extractGeorgeAnswer(json: unknown): { answer: string | null; conversationId?: string } {
  if (!json || typeof json !== 'object') {
    return { answer: typeof json === 'string' ? json : null };
  }
  const j = json as Record<string, unknown>;
  // Try the most likely paths.
  const candidates: Array<unknown> = [
    j.answer,
    j.response,
    j.message,
    j.text,
    j.content,
    (j.result as Record<string, unknown> | undefined)?.answer,
    (j.result as Record<string, unknown> | undefined)?.response,
    (j.result as Record<string, unknown> | undefined)?.text,
    (j.data as Record<string, unknown> | undefined)?.answer,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) {
      const conversationId =
        (j.conversation_id as string | undefined) ??
        ((j.result as Record<string, unknown> | undefined)?.conversation_id as string | undefined);
      return { answer: c, conversationId };
    }
  }
  // Last resort — return the whole thing so we can see what came back.
  return { answer: `(unexpected response shape — raw payload below)\n\n\`\`\`json\n${JSON.stringify(json, null, 2).slice(0, 1500)}\n\`\`\`` };
}

/**
 * Ask George — PropertyData's hosted AI. Wraps the /george POST endpoint.
 * Used by the Bellwoods Concierge in the co-founder dashboard. Conversation
 * is preserved by the caller (we pass history with each call).
 *
 * NOT cached — every question is unique and questions can be follow-ups
 * that need fresh state.
 *
 * Permissive parsing — PropertyData's response shape isn't documented, so
 * we try multiple field paths and fall back to surfacing the raw response
 * if we can't find a clean answer string.
 */
export async function askGeorge(input: {
  question: string;
  conversation?: GeorgeMessage[];
  context?: string;
}) {
  const apiKey = env.PROPERTYDATA_API_KEY;
  if (!apiKey) {
    return { answer: null, error: 'no_api_key' as const };
  }

  const url = `${API_BASE}/george`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({
        question: input.question,
        conversation: input.conversation ?? [],
        context: input.context ?? undefined,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      console.warn(`[propertydata] /george ${res.status}: ${text.slice(0, 500)}`);
      // Surface the upstream error message to the caller so the UI can show
      // something useful rather than a generic "try again later".
      return {
        answer: null,
        error: 'request_failed' as const,
        upstreamStatus: res.status,
        upstreamMessage: text.slice(0, 500),
      };
    }
    const json = await res.json().catch(() => null);
    if (!json) {
      console.warn('[propertydata] /george returned non-JSON body');
      return { answer: null, error: 'invalid_response' as const };
    }
    // /george is roughly 5 credits per call (it's a POST, not routed through
    // fetchPropertyData, so account for the spend here).
    logCreditUsage('/george', 5, false);
    const { answer, conversationId } = extractGeorgeAnswer(json);
    if (!answer) {
      // Something came back but we couldn't extract a meaningful answer.
      // Log the keys at the top level so we can debug without printing
      // potentially sensitive content.
      console.warn(
        '[propertydata] /george response had no extractable answer. Top-level keys:',
        Object.keys(json as Record<string, unknown>),
      );
      return { answer: null, error: 'no_answer_extracted' as const };
    }
    return { answer, conversationId, error: null as null };
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') {
      console.warn('[propertydata] /george timed out after 30s');
      return { answer: null, error: 'timeout' as const };
    }
    console.warn('[propertydata] /george failed', error);
    return { answer: null, error: 'unexpected' as const };
  } finally {
    clearTimeout(timer);
  }
}
