import { env } from '@/env';
import { KEPT_VOICE_RULES } from '@repo/ai/brand-voice';
import { callClaudeForJson, CLAUDE_HAIKU } from '@repo/ai/claude';
import { database } from '@repo/database';
import { NextResponse } from 'next/server';

/**
 * Weekly marketer cron (Sundays 18:30 UTC).
 *
 * One pass:
 *
 *   LinkedIn topic basket
 *     Asks Claude for 5 educational topics for the week ahead, anchored to
 *     UK property news of the past 7 days. Persists ONE `approve_linkedin_post`
 *     FounderAction containing all 5 — the founder picks/edits 1-2 in a
 *     single review.
 *
 *   (Pass 2, the two weekly blog drafts on fixed topics, moved to
 *   /cron/guide-research on 17 Sep 2026: one evergreen guide a week, picked
 *   from live signals, with a GuidePost row the founder can publish.)
 *
 * NEVER auto-publishes anything. Always founder-approved.
 */

const LINKEDIN_SYSTEM_PROMPT = `You plan a week of LinkedIn content for Kept, a UK direct-to-vendor property buyer (chain-break, probate, problem properties).

Audience: UK estate agents, conveyancers, IFAs, mortgage brokers, property professionals. NOT vendors. Peer-to-peer voice.

${KEPT_VOICE_RULES}

FORMAT.
- Each idea ≤ 25 words. Educational, not promotional. No motivational quotes.
- Public market figures are welcome here (an index move, a rate change) with the source named. Our own offers, prices and discounts are not.
- Topics MUST be anchored to UK property news of the past 7 days: interest rate moves, HMRC/SDLT changes, planning law shifts, market data drops (Nationwide, Halifax, ONS, HMLR), known broker/agent industry news.

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

  // ── Log an AgentEvent so the morning briefing can pick it up.
  await database.agentEvent
    .create({
      data: {
        agent: 'marketer',
        eventType: 'marketer_weekly',
        summary: `Marketer weekly: ${linkedInResult.topicsDrafted} LI topics`,
        count: linkedInResult.topicsDrafted,
        payload: {
          linkedIn: linkedInResult,
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
            "Claude was unavailable (or returned no parseable topics) for this week's LinkedIn basket.",
            '',
            'Manually pick 1-2 angles for the week. Reference recent UK property news (Nationwide/Halifax index, HMLR drops, SDLT changes, interest-rate moves).',
          ].join('\n'),
          metadata: JSON.parse(
            JSON.stringify({
              workflow: 'marketer_weekly_linkedin_fallback',
              weekStart,
            })
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
        `${i + 1}. **${t.title}**\n   ${t.hook}\n   tags: ${t.suggestedHashtags.join(' ')}`
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
          })
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
