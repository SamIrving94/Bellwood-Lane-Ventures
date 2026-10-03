/**
 * Prompt shaping for the shared LLM client.
 *
 * Pure: no SDK instances, no env, no 'server-only', so the shape can be
 * unit-tested against the AI SDK's own prompt validator
 * (__tests__/prompt-shape.test.ts). claude.ts imports it; nothing else should.
 *
 * Why this file exists. From 12 Sep to 3 Oct 2026 every marketer call with
 * a long system prompt failed before it reached a provider:
 *
 *   Invalid prompt: messages must be an array of CoreMessage or UIMessage
 *
 * The cached-system shape put a text-part ARRAY in the system message so
 * the Anthropic provider would emit a `cache_control` block. AI SDK 4.1's
 * CoreSystemMessage schema allows only a string there, and because the
 * error is raised by the SDK, not a provider, the fallback chain could not
 * rescue it: every attempt failed identically and the log said
 * `all_providers_failed`. Zero LinkedIn baskets, paid-ad sets, outreach or
 * blog drafts were produced in that window.
 *
 * The same schema does allow message-level `providerOptions`, and both the
 * Anthropic and OpenRouter providers read the cache breakpoint from there
 * (`message.providerMetadata.anthropic.cacheControl`). So the system
 * message stays a string and the breakpoint rides alongside it.
 */
import type { CoreMessage } from 'ai';

export type PromptImage = { data: string; mediaType: string };

export type PromptInput = {
  system: string;
  user: string;
  images?: PromptImage[];
};

export type PromptShape =
  | { mode: 'simple'; system: string; prompt: string }
  | { mode: 'messages'; messages: CoreMessage[] };

/**
 * Ephemeral prompt-cache breakpoint. The OpenRouter provider also reads the
 * `anthropic` key, so one object serves both routes.
 */
export const CACHE_CONTROL_PROVIDER_OPTIONS = {
  anthropic: { cacheControl: { type: 'ephemeral' as const } },
};

/**
 * Build what generateText / generateObject receive.
 *
 *   - No cache, no images → the simple `system` + `prompt` form.
 *   - Cache on → a messages array whose system message is a plain string
 *     carrying `providerOptions` for the cache breakpoint.
 *   - Images → the user turn becomes image parts followed by the text.
 */
export function buildPromptShape(
  input: PromptInput,
  enableCache: boolean
): PromptShape {
  const images = input.images ?? [];
  if (!enableCache && images.length === 0) {
    return { mode: 'simple', system: input.system, prompt: input.user };
  }

  const systemMsg: CoreMessage = enableCache
    ? {
        role: 'system',
        content: input.system,
        providerOptions: CACHE_CONTROL_PROVIDER_OPTIONS,
      }
    : { role: 'system', content: input.system };

  const userMsg: CoreMessage =
    images.length > 0
      ? {
          role: 'user',
          content: [
            ...images.map((img) => ({
              type: 'image' as const,
              image: img.data,
              mimeType: img.mediaType,
            })),
            { type: 'text' as const, text: input.user },
          ],
        }
      : { role: 'user', content: input.user };

  return { mode: 'messages', messages: [systemMsg, userMsg] };
}
