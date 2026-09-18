import { env } from '@/env';
import { callClaudeForJson } from '@repo/ai/claude';
import { database } from '@repo/database';
import { NextResponse } from 'next/server';
import { recordCronHeartbeat } from '../_lib/heartbeat';
import { selfOrigin } from '../_lib/self-origin';
import {
  candidateQuestions,
  type EvergreenQuestion,
  findQuestion,
} from '../_lib/guides/evergreen-questions';
import {
  consolidate,
  DEFAULT_FEEDS,
  fetchFeeds,
  fetchReddit,
  type Signal,
  type SourceReport,
} from '../_lib/guides/signals';

// Feeds + Reddit + one LLM call + the drafter's two calls. Pro-plan cap.
export const maxDuration = 300;

/**
 * Weekly guide research (Saturdays 06:00 UTC).
 *
 * Drafts ONE evergreen guide a week for the founder to review and publish:
 *
 *   1. LISTEN — pull the last seven days from UK property trade feeds and
 *      gov.uk HMLR news, plus Reddit's UK housing subs when credentials are
 *      set. Every source failure is a line in the brief, never a dead cron.
 *   2. PICK — the model ranks the evergreen questions not written in the
 *      last 12 weeks against those signals and returns three candidates,
 *      each with a hook and the signal indices that justify it. Indices,
 *      not URLs: the model cannot cite a source it was not shown.
 *   3. DRAFT — /agents/marketer/draft-blog writes the top pick in Kept
 *      voice with the hook and only those sources, runs the compliance
 *      audit, and parks a GuidePost + FounderAction for review. The other
 *      two candidates ride along in the action metadata so the founder can
 *      swap.
 *
 * If the model is down the cron still drafts the next unwritten question
 * with no hook. A week with no draft is the failure mode we are avoiding.
 * NEVER publishes. Publishing is a founder click in /marketing/guides.
 */

const ROTATION_WEEKS = 12;
const LOOKBACK_DAYS = 7;

const PICK_SYSTEM_PROMPT = `You choose which evergreen guide Kept, a UK direct-to-vendor property buyer, should write this week.

You will receive:
- SIGNALS: numbered items from UK property trade press, HM Land Registry news and Reddit's UK housing forums, last seven days.
- QUESTIONS: the evergreen questions still to be written, each with a key.

Pick the THREE questions this week's signals give the best reason to answer now. A reason is a real thread, article or announcement in the signals, not a guess about the season. If no signal fits a question, it can still be picked for being next in line, with an empty signalRefs and a null hook.

For each pick write a hook: one or two plain sentences that could open the guide, grounded in the cited signal. No figures unless the signal states them. No urgency. No em dashes. UK spelling.

Return ONLY JSON:
{
  "picks": [
    { "key": string, "why": string, "hook": string | null, "signalRefs": number[] }
  ]
}
Exactly three picks, best first. signalRefs are indices into SIGNALS. Never invent a source.`;

type Pick = {
  key: string;
  why: string;
  hook: string | null;
  signalRefs: number[];
};

function isPickList(v: unknown): v is { picks: Pick[] } {
  if (!v || typeof v !== 'object') return false;
  const picks = (v as { picks?: unknown }).picks;
  return (
    Array.isArray(picks) &&
    picks.every(
      (p) =>
        p &&
        typeof p === 'object' &&
        typeof (p as Pick).key === 'string' &&
        typeof (p as Pick).why === 'string' &&
        ((p as Pick).hook === null || typeof (p as Pick).hook === 'string') &&
        Array.isArray((p as Pick).signalRefs) &&
        (p as Pick).signalRefs.every((n) => Number.isInteger(n))
    )
  );
}

async function readFeeds(): Promise<{ name: string; url: string }[]> {
  try {
    const row = await database.setting.findUnique({
      where: { key: 'guides.feeds' },
    });
    if (row && Array.isArray(row.value)) {
      const feeds = (row.value as unknown[]).flatMap((f) => {
        if (!f || typeof f !== 'object') return [];
        const o = f as Record<string, unknown>;
        return typeof o.name === 'string' && typeof o.url === 'string'
          ? [{ name: o.name, url: o.url }]
          : [];
      });
      if (feeds.length > 0) return feeds;
    }
  } catch (err) {
    console.warn('[guide-research] guides.feeds setting unreadable', err);
  }
  return [...DEFAULT_FEEDS];
}

async function recentQuestionKeys(): Promise<string[]> {
  const since = new Date(Date.now() - ROTATION_WEEKS * 7 * 24 * 3600 * 1000);
  const rows = await database.guidePost
    .findMany({
      where: { createdAt: { gte: since }, status: { not: 'archived' } },
      orderBy: { createdAt: 'desc' },
      select: { questionKey: true },
    })
    .catch(() => [] as Array<{ questionKey: string }>);
  return rows.map((r) => r.questionKey);
}

function signalsForPrompt(signals: Signal[]): string {
  return signals
    .map((s, i) => {
      const when = s.publishedAt ? s.publishedAt.slice(0, 10) : 'undated';
      const excerpt = s.excerpt ? ` :: ${s.excerpt.slice(0, 220)}` : '';
      return `[${i}] (${s.source}, ${when}) ${s.title}${excerpt}`;
    })
    .join('\n');
}

export const POST = async (request: Request) => {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = new Date();
  const runId = `guide-research:${startedAt.toISOString().slice(0, 10)}`;

  // ── 1. Listen ─────────────────────────────────────────────────────────
  const sinceMs = Date.now() - LOOKBACK_DAYS * 24 * 3600 * 1000;
  const feeds = await readFeeds();
  const reddit = await fetchReddit(
    env.REDDIT_CLIENT_ID && env.REDDIT_CLIENT_SECRET
      ? {
          clientId: env.REDDIT_CLIENT_ID,
          clientSecret: env.REDDIT_CLIENT_SECRET,
          userAgent: env.REDDIT_USER_AGENT,
        }
      : null
  );
  const rss = await fetchFeeds(feeds, sinceMs);
  const signals = consolidate([...rss.signals, ...reddit.signals]);
  const reports: SourceReport[] = [...rss.reports, ...reddit.reports];

  // ── 2. Pick ───────────────────────────────────────────────────────────
  const recent = await recentQuestionKeys();
  const candidates = candidateQuestions(recent);

  let picks: Pick[] = [];
  let pickFallback = false;
  if (signals.length > 0) {
    const raw = await callClaudeForJson<unknown>({
      system: PICK_SYSTEM_PROMPT,
      user: [
        `Week ending ${startedAt.toISOString().slice(0, 10)}.`,
        '',
        'SIGNALS:',
        signalsForPrompt(signals),
        '',
        'QUESTIONS:',
        candidates
          .map((q) => `- ${q.key}: ${q.question} (${q.segment})`)
          .join('\n'),
        '',
        'Choose three. JSON only.',
      ].join('\n'),
      maxTokens: 900,
      temperature: 0.3,
      feature: 'guide_topic_pick',
      cacheSystemPrompt: true,
    }).catch((err) => {
      console.warn('[guide-research] topic pick failed', err);
      return null;
    });

    if (isPickList(raw)) {
      const known = new Set(candidates.map((q) => q.key));
      picks = raw.picks
        .filter((p) => known.has(p.key))
        .map((p) => ({
          ...p,
          signalRefs: p.signalRefs.filter((n) => n >= 0 && n < signals.length),
        }))
        .slice(0, 3);
    }
  }
  if (picks.length === 0) {
    // Model down, no signals, or nothing parseable: draft the next question
    // in line with no hook. The cadence holds; the founder still gets a card.
    pickFallback = true;
    picks = candidates.slice(0, 3).map((q) => ({
      key: q.key,
      why: 'Next in the evergreen rotation (no usable signal this week).',
      hook: null,
      signalRefs: [],
    }));
  }

  const top = picks[0];
  const question = findQuestion(top.key) as EvergreenQuestion;
  const sources = top.signalRefs.map((i) => {
    const s = signals[i];
    return {
      title: s.title,
      url: s.url,
      source: s.source,
      publishedAt: s.publishedAt,
    };
  });

  // ── 3. Draft ──────────────────────────────────────────────────────────
  const bearer = env.BELLWOOD_API_KEY ?? env.PAPERCLIP_API_KEY;
  let drafted = false;
  let draftError: string | undefined;
  let guidePostId: string | null = null;

  if (!bearer) {
    draftError = 'BELLWOOD_API_KEY not set; cannot call the drafter';
  } else {
    try {
      const res = await fetch(`${selfOrigin()}/agents/marketer/draft-blog`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${bearer}`,
        },
        body: JSON.stringify({
          topic: question.question,
          segment: question.segment,
          primaryKeyword: question.primaryKeyword,
          questionKey: question.key,
          hook: top.hook ?? undefined,
          sources,
          candidates: picks.slice(1).map((p) => ({
            key: p.key,
            question: findQuestion(p.key)?.question ?? p.key,
            why: p.why,
            hook: p.hook,
          })),
          research: {
            runId,
            signalCount: signals.length,
            reports,
            pickFallback,
          },
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        guidePostId?: string | null;
        error?: string;
      };
      if (res.ok && json.success) {
        drafted = true;
        guidePostId = json.guidePostId ?? null;
      } else {
        draftError = json.error ?? `drafter HTTP ${res.status}`;
      }
    } catch (err) {
      draftError = err instanceof Error ? err.message : String(err);
    }
  }

  if (!drafted) {
    // The founder must know a week went by with no guide.
    await database.founderAction
      .upsert({
        where: { dedupKey: runId },
        create: {
          type: 'general',
          priority: 'medium',
          status: 'pending',
          agent: 'marketer',
          dedupKey: runId,
          title: `No guide drafted this week: ${question.question}`,
          description: [
            `The weekly guide could not be drafted. Reason: ${draftError ?? 'unknown'}.`,
            '',
            `Intended question: **${question.question}** (${question.key}).`,
            top.hook ? `Hook: ${top.hook}` : 'No hook this week.',
            '',
            'Sources checked:',
            ...reports.map(
              (r) =>
                `- ${r.source}: ${r.ok ? `${r.count} items` : `failed (${r.note ?? 'no detail'})`}`
            ),
          ].join('\n'),
          metadata: JSON.parse(
            JSON.stringify({
              workflow: 'guide_research_failed',
              picks,
              reports,
            })
          ),
        },
        update: {
          status: 'pending',
          description: `Retry failed again: ${draftError ?? 'unknown'}`,
        },
      })
      .catch((err) =>
        console.warn('[guide-research] failure card upsert failed', err)
      );
  }

  await database.agentEvent
    .create({
      data: {
        agent: 'marketer',
        eventType: 'guide_research',
        summary: drafted
          ? `Guide research: drafted "${question.question}" from ${signals.length} signals`
          : `Guide research: no draft (${draftError ?? 'unknown'})`,
        count: drafted ? 1 : 0,
        pipelineRunId: runId,
        payload: JSON.parse(
          JSON.stringify({
            picks,
            reports,
            signalCount: signals.length,
            pickFallback,
            guidePostId,
          })
        ),
      },
    })
    .catch((err) => console.warn('[guide-research] event log failed', err));

  // Heartbeat on any completed run: a run that could not draft still ran,
  // and the failure card above is the louder signal for that case.
  await recordCronHeartbeat('guide-research', {
    runId,
    note: drafted
      ? `drafted ${question.key}`
      : `no draft: ${draftError ?? 'unknown'}`,
  });

  return NextResponse.json({
    success: true,
    runId,
    signals: signals.length,
    reports,
    picks,
    pickFallback,
    drafted,
    draftError: draftError ?? null,
    guidePostId,
    durationMs: Date.now() - startedAt.getTime(),
  });
};
