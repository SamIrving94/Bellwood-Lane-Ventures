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
    let errorMessage = 'Could not reach PropertyData. Try again in a moment.';
    if (result.error === 'no_api_key') {
      errorMessage = 'PropertyData not configured. Set PROPERTYDATA_API_KEY on the bellwood-app Vercel project.';
    } else if (result.error === 'timeout') {
      errorMessage = "George took longer than 30 seconds to answer. Try a simpler question or try again.";
    } else if (result.error === 'no_answer_extracted') {
      errorMessage = "PropertyData responded but we couldn't extract an answer. Engineer to investigate (check Vercel logs for the response shape).";
    } else if (result.error === 'request_failed') {
      const r = result as { upstreamStatus?: number; upstreamMessage?: string };
      if (r.upstreamStatus === 401 || r.upstreamStatus === 403) {
        errorMessage = `PropertyData rejected the API key (HTTP ${r.upstreamStatus}). Check the key is correct and the account is active.`;
      } else if (r.upstreamStatus === 429) {
        errorMessage = "PropertyData rate-limited us. Wait a minute and try again.";
      } else if (r.upstreamStatus === 402) {
        errorMessage = "PropertyData credits exhausted. Top up at propertydata.co.uk.";
      } else if (r.upstreamStatus) {
        errorMessage = `PropertyData returned HTTP ${r.upstreamStatus}: ${r.upstreamMessage ?? ''}`.slice(0, 300);
      }
    }
    return NextResponse.json({ error: errorMessage }, { status: 503 });
  }

  return NextResponse.json({
    answer: result.answer,
  });
}
