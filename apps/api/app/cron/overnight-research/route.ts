import { env } from '@/env';
import { keys as aiKeys } from '@repo/ai/keys';
import { database } from '@repo/database';
import { NextResponse } from 'next/server';

// Web search is server-side on Anthropic's end but each search adds latency;
// 8 searches + synthesis can take a couple of minutes. Pro-plan cap.
export const maxDuration = 300;

/**
 * Overnight analyst — runs at 05:30 UTC, before the founders wake up.
 *
 * Uses Claude's server-side web search tool to scan overnight/recent local
 * signals for Bellwood's target areas (planning news, market shifts, auction
 * activity, distressed-seller-relevant items) and writes ONE morning-brief
 * FounderAction that the Today page and Action Centre surface.
 *
 * NOTE ON THE LLM CALL: packages/ai callClaude does not support tools, and
 * the installed @ai-sdk/anthropic (1.2.12) predates the provider-defined
 * webSearch_20250305 tool. We therefore call the Anthropic Messages API
 * directly with the raw `web_search_20250305` server tool and log usage
 * manually to LlmCallLog (the setLlmLogger path only covers callClaude).
 */

const MODEL = 'claude-sonnet-4-5';
const MAX_TOKENS = 3000;
const MAX_WEB_SEARCHES = 8;
const MAX_AREAS = 5;

type TargetArea = { postcode: string; label?: string };

/**
 * Read the founder-configured target areas — same source of truth as the
 * scouting cron: `scouting.areas` (each { seedPostcode, label, ... }), with
 * a legacy fallback to `scouting.targetPostcodes` (string[]). Capped at 5.
 */
async function readTargetAreas(): Promise<TargetArea[]> {
  try {
    const areasSetting = await database.setting.findUnique({
      where: { key: 'scouting.areas' },
    });
    if (areasSetting && Array.isArray(areasSetting.value)) {
      const areas = (areasSetting.value as unknown[]).flatMap((raw) => {
        if (!raw || typeof raw !== 'object') return [];
        const a = raw as Record<string, unknown>;
        const postcode =
          typeof a.seedPostcode === 'string' ? a.seedPostcode.trim() : null;
        const label = typeof a.label === 'string' ? a.label : undefined;
        return postcode ? [{ postcode, label }] : [];
      });
      if (areas.length > 0) return areas.slice(0, MAX_AREAS);
    }
  } catch (err) {
    console.warn('[cron/overnight-research] failed to read scouting.areas', err);
  }

  // Legacy fallback — plain district/postcode strings.
  try {
    const districtsRow = await database.setting.findUnique({
      where: { key: 'scouting.targetPostcodes' },
    });
    if (districtsRow && Array.isArray(districtsRow.value)) {
      return (districtsRow.value as unknown[])
        .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
        .slice(0, MAX_AREAS)
        .map((postcode) => ({ postcode: postcode.trim() }));
    }
  } catch (err) {
    console.warn(
      '[cron/overnight-research] failed to read scouting.targetPostcodes',
      err,
    );
  }
  return [];
}

// ── Minimal Messages-API response shape (only the fields we read) ──────
type AnthropicContentBlock = {
  type: string;
  text?: string;
};

type AnthropicMessagesResponse = {
  content?: AnthropicContentBlock[];
  stop_reason?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    server_tool_use?: { web_search_requests?: number };
  };
};

export const POST = async (request: Request) => {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Failures always return 200 with { error } so Vercel doesn't retry-storm
  // and the watchdog picture stays clean — a missing brief is low-stakes.
  try {
    const apiKey = aiKeys().ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        error: 'ANTHROPIC_API_KEY not configured — overnight brief skipped',
      });
    }

    const dayBucket = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
    const dedupKey = `overnight-brief:${dayBucket}`;

    // Skip if today's brief already exists (manual re-run, cron retry).
    const existing = await database.founderAction.findUnique({
      where: { dedupKey },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({
        success: true,
        skipped: 'brief already exists for today',
        actionId: existing.id,
      });
    }

    const areas = await readTargetAreas();
    if (areas.length === 0) {
      return NextResponse.json({
        error: 'no target areas configured (scouting.areas is empty)',
      });
    }

    const areaList = areas
      .map((a) => (a.label ? `${a.postcode} (${a.label})` : a.postcode))
      .join(', ');

    const prompt = [
      `You are the overnight market analyst for Bellwood, a two-founder UK company that buys property directly from vendors for cash. Their deal types: probate sales, chain breaks, short leases, and repossessions.`,
      ``,
      `Target areas (UK postcodes): ${areaList}.`,
      ``,
      `Use web search to find RECENT (last few days, ideally last 24-48 hours) local signals for these areas:`,
      `- planning applications, approvals, or development news`,
      `- local property market shifts (prices, listings, time-on-market)`,
      `- auction activity and notable auction lots`,
      `- anything relevant to motivated or distressed sellers (repossession trends, probate/estate news, chain-collapse signals, landlord exits)`,
      ``,
      `Then write a morning brief answering: "what should two founders buying property in these areas know this morning?"`,
      ``,
      `Format rules (the reader is dyslexic):`,
      `- UK English. Concise markdown.`,
      `- Short sentences. Bullet points. **Bold** the key facts.`,
      `- Clear ## headings, one per theme or area. No dense paragraphs.`,
      `- Lead with a 2-3 bullet "**Top takeaways**" section.`,
      `- If a search found nothing new for an area, say so in one line — do not pad.`,
      `- End with a one-line "Worth a look today" suggestion if anything is actionable.`,
    ].join('\n');

    const startedAt = Date.now();
    let brief = '';
    let usage: AnthropicMessagesResponse['usage'];
    let stopReason: string | undefined;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          messages: [{ role: 'user', content: prompt }],
          tools: [
            {
              type: 'web_search_20250305',
              name: 'web_search',
              max_uses: MAX_WEB_SEARCHES,
              user_location: {
                type: 'approximate',
                country: 'GB',
                timezone: 'Europe/London',
              },
            },
          ],
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(
          `Anthropic API ${res.status}: ${body.slice(0, 300)}`,
        );
      }

      const data = (await res.json()) as AnthropicMessagesResponse;
      usage = data.usage;
      stopReason = data.stop_reason;
      // The response interleaves server_tool_use / web_search_tool_result
      // blocks with text; the brief is the concatenated text blocks.
      brief = (data.content ?? [])
        .filter((b) => b.type === 'text' && typeof b.text === 'string')
        .map((b) => b.text)
        .join('\n')
        .trim();

      // Manual LLM usage log — the setLlmLogger path only covers callClaude.
      await database.llmCallLog
        .create({
          data: {
            feature: 'overnight_analyst',
            model: MODEL,
            inputTokens: usage?.input_tokens ?? 0,
            outputTokens: usage?.output_tokens ?? 0,
            durationMs: Date.now() - startedAt,
            success: brief.length > 0,
            errorReason: brief.length > 0 ? null : 'empty response text',
          },
        })
        .catch((err: unknown) =>
          console.warn('[cron/overnight-research] llm log failed', err),
        );
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      await database.llmCallLog
        .create({
          data: {
            feature: 'overnight_analyst',
            model: MODEL,
            durationMs: Date.now() - startedAt,
            success: false,
            errorReason: reason.slice(0, 500),
          },
        })
        .catch(() => undefined);
      return NextResponse.json({ error: `LLM call failed: ${reason}` });
    }

    if (!brief) {
      return NextResponse.json({
        error: 'LLM returned no text — brief not created',
        stopReason,
      });
    }

    // ── Surface: one founder action per day ─────────────────────────────
    // ActionType is a Prisma enum (no free strings) — 'general' is the
    // catch-all the Action Centre and Today page both render, with the
    // markdown brief in the expandable description.
    const action = await database.founderAction.create({
      data: {
        type: 'general',
        priority: 'medium',
        status: 'pending',
        agent: 'system',
        dedupKey,
        title: `Overnight market brief — ${dayBucket}`,
        description: brief,
        metadata: {
          source: 'cron_overnight_research',
          areas: areas.map((a) => a.postcode),
          webSearchRequests: usage?.server_tool_use?.web_search_requests ?? null,
          inputTokens: usage?.input_tokens ?? null,
          outputTokens: usage?.output_tokens ?? null,
          model: MODEL,
          dayBucket,
        },
      },
    });

    return NextResponse.json({
      success: true,
      actionId: action.id,
      areas: areas.map((a) => a.postcode),
      briefChars: brief.length,
      webSearchRequests: usage?.server_tool_use?.web_search_requests ?? null,
      stopReason,
    });
  } catch (err) {
    // Never crash — a missing brief is not worth an alerting retry loop.
    const reason = err instanceof Error ? err.message : String(err);
    console.warn('[cron/overnight-research] run failed', err);
    return NextResponse.json({ error: reason });
  }
};

// Vercel cron sends GET by default. Accept either method so a manual
// POST and an automated GET both reach the same handler.
export const GET = POST;
