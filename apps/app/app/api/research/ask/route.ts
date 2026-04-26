import { auth } from '@repo/auth/server';
import { askGeorge, type GeorgeMessage } from '@repo/property-data';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const Input = z.object({
  question: z.string().min(1).max(2000),
  conversation: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      }),
    )
    .max(50)
    .optional(),
});

const BELLWOOD_CONTEXT =
  'I am a co-founder of Bellwoods Lane, a UK direct-to-vendor cash property buyer. ' +
  'We buy chain breaks, mortgage failures, survey down-valuations, probate, ' +
  'repossessions and problem properties. We pay introducer fees to estate ' +
  'agents and instruct them on resale. Help me with deal sourcing, market ' +
  'intelligence, and underwriting decisions. Keep responses tight and useful.';

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = Input.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await askGeorge({
    question: parsed.data.question,
    conversation: parsed.data.conversation as GeorgeMessage[] | undefined,
    context: BELLWOOD_CONTEXT,
  });

  if (result.error || !result.answer) {
    return NextResponse.json(
      {
        error:
          result.error === 'no_api_key'
            ? 'PropertyData not configured. Set PROPERTYDATA_API_KEY in Vercel.'
            : 'Could not reach PropertyData. Try again in a moment.',
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    answer: result.answer,
  });
}
