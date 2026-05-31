import { env } from '@/env';
import { callClaudeForJson, CLAUDE_HAIKU } from '@repo/ai/claude';
import { database } from '@repo/database';
import { NextResponse } from 'next/server';

/**
 * Weekly marketer cron (Sundays 18:30 UTC).
 *
 * Two passes inside one cron:
 *
 *   Pass 1 — LinkedIn topic basket
 *     Asks Claude for 5 educational topics for the week ahead, anchored to
 *     UK property news of the past 7 days. Persists ONE `approve_linkedin_post`
 *     FounderAction containing all 5 — the founder picks/edits 1-2 in a
 *     single review.
 *
 *   Pass 2 — Two blog drafts (via /agents/marketer/draft-blog)
 *     Looks at the most recent 2 distinct `sellerType` values from completed
 *     deals in the last 30 days and asks the existing blog-draft endpoint to
 *     draft a post for each. That endpoint creates its own
 *     `approve_blog_draft` FounderActions + audits, so we don't duplicate
 *     here.
 *
 * NEVER auto-publishes anything. Always founder-approved.
 */

const LINKEDIN_SYSTEM_PROMPT = `You plan a week of LinkedIn content for Bellwood Ventures, a UK direct-to-vendor property buyer (chain-break, probate, problem properties).

Audience: UK estate agents, conveyancers, IFAs, mortgage brokers, property professionals. NOT vendors. Peer-to-peer voice.

Voice rules (marketing plan §2):
- Numbers + specifics over adjectives. UK spelling. £ symbol with grouped thousands.
- Slightly dry. Professional. No motivational quotes. No "thoughts?" closers.
- Each idea ≤ 25 words. Educational, not promotional.
- Topics MUST be anchored to UK property news of the past 7 days — interest rate moves, HMRC/SDLT changes, planning law shifts, market data drops (Nationwide, Halifax, ONS, HMLR), known broker/agent industry news.

NEVER use:
- "AI", "machine learning", "algorithm", "powered by"
- "Game changer", "industry-leading", "revolutionary"
- "Did you know…" or any other engagement-bait opener

You will be given the current date. Return ONLY JSON (no markdown fences):

{
  "topics": [
    {
      "title": string,                    // ≤ 70 chars, the post hook
      "hook": string,                     // ≤ 25 words, what makes it interesting THIS week (cite the news anchor)
      "suggestedHashtags": string[]       // 2-4 lowercase, UK property + the specific niche
    }
  ]
}

EXACTLY 5 topics. Different angles — don't repeat the same news story 5 ways.`;

interface LinkedInTopicBasket {
  topics: Array<{
    title: string;
    hook: string;
    suggestedHashtags: string[];
  }>;
}

export const POST = async (request: Request) => {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const runDate = new Date();

  // ─── Pass 1: LinkedIn topic basket ───────────────────────────────────
  const linkedInResult = await draftLinkedInTopics(runDate);

  // ─── Pass 2: Two blog drafts via /agents/marketer/draft-blog ─────────
  const blogResult = await draftSegmentBlogs(request);

  // ── Log an AgentEvent so the morning briefing can pick it up.
  await database.agentEvent
    .create({
      data: {
        agent: 'marketer',
        eventType: 'marketer_weekly',
        summary: `Marketer weekly: ${linkedInResult.topicsDrafted} LI topics + ${blogResult.blogsRequested} blog drafts requested`,
        count: linkedInResult.topicsDrafted + blogResult.blogsRequested,
        payload: {
          linkedIn: linkedInResult,
          blogs: blogResult,
        },
      },
    })
    .catch((err) => {
      console.warn('[marketer-weekly] event log failed', err);
    });

  return NextResponse.json({
    success: true,
    runDate: runDate.toISOString(),
    linkedIn: linkedInResult,
    blogs: blogResult,
  });
};

// ────────────────────────────────────────────────────────────────────────────
// Pass 1 — LinkedIn topic basket
// ────────────────────────────────────────────────────────────────────────────

async function draftLinkedInTopics(runDate: Date): Promise<{
  topicsDrafted: number;
  actionCreated: boolean;
  fallback: boolean;
}> {
  const weekStart = runDate.toISOString().slice(0, 10);

  const basket = await callClaudeForJson<LinkedInTopicBasket>({
    system: LINKEDIN_SYSTEM_PROMPT,
    user: [
      `Current date: ${weekStart}`,
      'Plan 5 LinkedIn educational topics for the week ahead. JSON only.',
    ].join('\n'),
    maxTokens: 900,
    temperature: 0.6,
    model: CLAUDE_HAIKU,
    feature: 'linkedin_topics',
    cacheSystemPrompt: true,
  }).catch((err) => {
    console.warn('[marketer-weekly] LI topic basket failed', err);
    return null;
  });

  if (!basket?.topics?.length) {
    // Fallback: one general action so Sam still gets nudged to post.
    await database.founderAction
      .create({
        data: {
          type: 'general',
          priority: 'low',
          status: 'pending',
          agent: 'marketer',
          title: 'Marketer weekly: LinkedIn topics need manual drafting',
          description: [
            'Claude was unavailable (or returned no parseable topics) for this week\'s LinkedIn basket.',
            '',
            'Manually pick 1-2 angles for the week. Reference recent UK property news (Nationwide/Halifax index, HMLR drops, SDLT changes, interest-rate moves).',
          ].join('\n'),
          metadata: JSON.parse(
            JSON.stringify({
              workflow: 'marketer_weekly_linkedin_fallback',
              weekStart,
            }),
          ),
        },
      })
      .catch((err) => {
        console.warn('[marketer-weekly] LI fallback action create failed', err);
      });
    return { topicsDrafted: 0, actionCreated: false, fallback: true };
  }

  const lines = basket.topics
    .map(
      (t, i) =>
        `${i + 1}. **${t.title}**\n   ${t.hook}\n   tags: ${t.suggestedHashtags.join(' ')}`,
    )
    .join('\n\n');

  const action = await database.founderAction
    .create({
      data: {
        type: 'approve_linkedin_post',
        priority: 'medium',
        status: 'pending',
        agent: 'marketer',
        title: `Approve LinkedIn topics for week of ${weekStart} (5 angles)`,
        description: [
          `Pick 1-2 to expand into full posts. Each topic is anchored to UK property news of the past 7 days.`,
          '',
          lines,
        ].join('\n'),
        metadata: JSON.parse(
          JSON.stringify({
            workflow: 'pick_and_expand',
            weekStart,
            channel: 'linkedin',
            topics: basket.topics,
          }),
        ),
      },
    })
    .catch((err) => {
      console.warn('[marketer-weekly] LI action create failed', err);
      return null;
    });

  return {
    topicsDrafted: basket.topics.length,
    actionCreated: action != null,
    fallback: false,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Pass 2 — Two blog drafts via /agents/marketer/draft-blog
// ────────────────────────────────────────────────────────────────────────────

// SellerType values that map to a valid /agents/marketer/draft-blog segment
// (the endpoint enums: probate | chain_break | distress | problem_property | agent).
const SELLER_TYPE_TO_SEGMENT: Record<
  string,
  'probate' | 'chain_break' | 'distress' | 'problem_property' | 'agent'
> = {
  probate: 'probate',
  chain_break: 'chain_break',
  repossession: 'distress',
  relocation: 'chain_break',
  short_lease: 'problem_property',
  standard: 'chain_break',
};

async function draftSegmentBlogs(request: Request): Promise<{
  blogsRequested: number;
  segments: string[];
  fallback: boolean;
}> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Pull the most recent distinct sellerTypes from completions in last 30 days.
  // groupBy keeps it cheap; we pick the 2 most recent by max(acquiredAt).
  const recent = await database.deal
    .findMany({
      where: {
        status: 'completed',
        acquiredAt: { gte: thirtyDaysAgo },
      },
      orderBy: { acquiredAt: 'desc' },
      select: { sellerType: true },
      take: 50,
    })
    .catch(() => [] as Array<{ sellerType: string }>);

  const seen = new Set<string>();
  const orderedSegments: string[] = [];
  for (const row of recent) {
    const segment = SELLER_TYPE_TO_SEGMENT[row.sellerType];
    if (!segment) continue;
    if (seen.has(segment)) continue;
    seen.add(segment);
    orderedSegments.push(segment);
    if (orderedSegments.length === 2) break;
  }

  // Fallback to probate + chain_break if no recent completions
  if (orderedSegments.length < 2) {
    const defaults: Array<'probate' | 'chain_break'> = ['probate', 'chain_break'];
    for (const d of defaults) {
      if (orderedSegments.length === 2) break;
      if (!seen.has(d)) {
        seen.add(d);
        orderedSegments.push(d);
      }
    }
  }

  if (!env.PAPERCLIP_API_KEY && !env.BELLWOOD_API_KEY) {
    console.warn('[marketer-weekly] no PAPERCLIP_API_KEY / BELLWOOD_API_KEY — skipping blog drafts');
    return { blogsRequested: 0, segments: orderedSegments, fallback: true };
  }

  const protocol = request.headers.get('x-forwarded-proto') ?? 'https';
  const host = request.headers.get('host') ?? 'localhost:3002';
  const url = `${protocol}://${host}/agents/marketer/draft-blog`;
  const bearer = env.BELLWOOD_API_KEY ?? env.PAPERCLIP_API_KEY ?? '';

  let blogsRequested = 0;
  const topicBySegment: Record<string, { topic: string; primaryKeyword: string }> = {
    probate: {
      topic: 'Selling an empty inherited property without dragging the estate',
      primaryKeyword: 'sell inherited property uk',
    },
    chain_break: {
      topic: 'What to do in the 48 hours after your buyer pulls out',
      primaryKeyword: 'buyer pulled out uk',
    },
    distress: {
      topic: 'Selling a house in financial difficulty without going through repossession',
      primaryKeyword: 'sell house repossession uk',
    },
    problem_property: {
      topic: 'Selling a property with knotweed, cladding or a short lease',
      primaryKeyword: 'sell problem property uk',
    },
    agent: {
      topic: 'How estate agents can save fall-through deals without losing the listing',
      primaryKeyword: 'fall through deal estate agent',
    },
  };

  for (const segment of orderedSegments) {
    const profile = topicBySegment[segment];
    if (!profile) continue;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${bearer}`,
        },
        body: JSON.stringify({
          topic: profile.topic,
          segment,
          primaryKeyword: profile.primaryKeyword,
          audienceNotes:
            'Weekly auto-request from marketer-weekly cron — anchor to recent completions in this segment.',
        }),
      });
      if (response.ok) {
        blogsRequested++;
      } else {
        console.warn(
          `[marketer-weekly] draft-blog ${segment} returned ${response.status}`,
        );
      }
    } catch (err) {
      console.warn(`[marketer-weekly] draft-blog ${segment} request failed`, err);
    }
  }

  return {
    blogsRequested,
    segments: orderedSegments,
    fallback: blogsRequested === 0,
  };
}
