import { generateText, type LanguageModelV1CallOptions } from 'ai';
import { MockLanguageModelV1 } from 'ai/test';
import { describe, expect, it } from 'vitest';
import { buildPromptShape } from '../prompt-shape';

// Longer than the 1024-char caching threshold in claude.ts.
const LONG_SYSTEM = 'You write guides for Kept. '.repeat(60);

/**
 * A model that answers "ok" and hands back exactly what the SDK gave it.
 * (This SDK version's mock does not record calls, so we capture them.)
 */
const mockModel = () => {
  const calls: LanguageModelV1CallOptions[] = [];
  const model = new MockLanguageModelV1({
    doGenerate: async (options) => {
      calls.push(options);
      return {
        rawCall: { rawPrompt: options.prompt, rawSettings: {} },
        finishReason: 'stop',
        usage: { promptTokens: 1, completionTokens: 1 },
        text: 'ok',
      };
    },
  });
  return { model, calls };
};

describe('buildPromptShape', () => {
  it('uses the simple system + prompt form when nothing needs messages', () => {
    const shape = buildPromptShape({ system: 'short', user: 'hi' }, false);
    expect(shape).toEqual({ mode: 'simple', system: 'short', prompt: 'hi' });
  });

  it('cached shape passes the AI SDK validator and carries the breakpoint', async () => {
    const shape = buildPromptShape({ system: LONG_SYSTEM, user: 'hi' }, true);
    expect(shape.mode).toBe('messages');
    if (shape.mode !== 'messages') return;

    const { model, calls } = mockModel();
    // generateText runs the CoreMessage zod validation before the model is
    // called. This is the line that threw in production.
    const result = await generateText({ model, messages: shape.messages });
    expect(result.text).toBe('ok');

    const sent = calls[0].prompt;
    expect(sent[0].role).toBe('system');
    if (sent[0].role !== 'system') return;
    expect(sent[0].content).toBe(LONG_SYSTEM);
    expect(sent[0].providerMetadata).toEqual({
      anthropic: { cacheControl: { type: 'ephemeral' } },
    });
    expect(sent[1].role).toBe('user');
  });

  it('the Sep 2026 shape is exactly what the validator rejects', async () => {
    // A text-part array in a system message: what claude.ts sent from
    // 12 Sep to 3 Oct 2026. Kept as a regression so nobody reintroduces it.
    const bad = [
      {
        role: 'system',
        content: [
          {
            type: 'text',
            text: LONG_SYSTEM,
            providerOptions: {
              anthropic: { cacheControl: { type: 'ephemeral' } },
            },
          },
        ],
      },
      { role: 'user', content: 'hi' },
    ];
    await expect(
      generateText({ model: mockModel().model, messages: bad as never })
    ).rejects.toThrow(/CoreMessage/);
  });

  it('images become parts of the user turn, system stays a string', async () => {
    const shape = buildPromptShape(
      {
        system: 'short',
        user: 'what condition?',
        images: [{ data: 'AAAA', mediaType: 'image/jpeg' }],
      },
      false
    );
    expect(shape.mode).toBe('messages');
    if (shape.mode !== 'messages') return;
    const [sys, user] = shape.messages;
    expect(sys).toEqual({ role: 'system', content: 'short' });
    expect(user.role).toBe('user');
    expect(Array.isArray(user.content)).toBe(true);
    const result = await generateText({
      model: mockModel().model,
      messages: shape.messages,
    });
    expect(result.text).toBe('ok');
  });
});
