import { env } from '@/env';
import {
  CLAUDE_SONNET,
  callClaudeWithMeta,
  hasLlmProvider,
} from '@repo/ai/claude';
import { database } from '@repo/database';
import { NextResponse } from 'next/server';

// Web search runs on OpenRouter's side before the model answers; search plus
// synthesis can take a couple of minutes. Pro-plan cap.
export const maxDuration = 300;

/**
 * Overnight analyst — runs at 05:30 UTC, before the founders wake up.
 *
 * Uses OpenRouter's web plugin (via the shared client's `webSearch`) to scan
 * overnight/recent local signals for Kept's target areas (planning news, market shifts, auction
 * activity, distressed-seller-relevant items) and writes ONE morning-brief
 * FounderAction that the Today page and Action Centre surface.
 *
 * LLM CALL: goes through @repo/ai/claude like every other feature, so it
 * gets routing (Settings → AI models, feature `overnight_analyst`), the
 * fallback chain and LlmCallLog for free. Until 3 Oct 2026 this route called
 * Anthropic's Messages API directly for its web_search tool and failed every
 * day from 9 Sep on an empty balance; Anthropic direct is retired.
 */

const MAX_TOKENS = 3000;
const MAX_WEB_RESULTS = 8;
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
    console.warn(
      '[cron/overnight-research] failed to read scouting.areas',
      err
    );
  }

  // Legacy fallback — plain district/postcode strings.
  try {
    const districtsRow = await database.setting.findUnique({
      where: { key: 'scouting.targetPostcodes' },
    });
    if (districtsRow && Array.isArray(districtsRow.value)) {
      return (districtsRow.value as unknown[])
        .filter(
          (v): v is string => typeof v === 'string' && v.trim().length > 0
        )
        .slice(0, MAX_AREAS)
        .map((postcode) => ({ postcode: postcode.trim() }));
    }
  } catch (err) {
    console.warn(
      '[cron/overnight-research] failed to read scouting.targetPostcodes',
      err
    );
  }
  return [];
}

export const POST = async (request: Request) => {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Failures always return 200 with { error } so Vercel doesn't retry-storm
  // and the watchdog picture stays clean — a missing brief is low-stakes.
  try {
    if (!hasLlmProvider()) {
      return NextResponse.json({
        error: 'no LLM provider key configured — overnight brief skipped',
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

    const system = [
      'You are the overnight market analyst for Kept, a two-founder UK company that buys property directly from vendors for cash. Their deal types: probate sales, chain breaks, short leases, and repossessions.',
      '',
      'You have live web search results in front of you. Use only what they support; if a search found nothing new for an area, say so in one line and do not pad.',
      '',
      'Format rules (the reader is dyslexic):',
      '- UK English. Concise markdown.',
      '- Short sentences. Bullet points. **Bold** the key facts.',
      '- Clear ## headings, one per theme or area. No dense paragraphs.',
      '- Lead with a 2-3 bullet "**Top takeaways**" section.',
      '- End with a one-line "Worth a look today" suggestion if anything is actionable.',
      '- Do not narrate your searching. Write the brief only.',
    ].join('\n');

    const user = [
      `Target areas (UK postcodes): ${areaList}.`,
      '',
      'Find RECENT (last few days, ideally last 24-48 hours) local signals for these areas:',
      '- planning applications, approvals, or development news',
      '- local property market shifts (prices, listings, time-on-market)',
      '- auction activity and notable auction lots',
      '- anything relevant to motivated or distressed sellers (repossession trends, probate/estate news, chain-collapse signals, landlord exits)',
      '',
      'Then write the morning brief answering: "what should two founders buying property in these areas know this morning?"',
    ].join('\n');

    // Routing, fallback and LlmCallLog all come from the shared client. The
    // web plugin runs on OpenRouter before the model's turn, so one call.
    const result = await callClaudeWithMeta({
      system,
      user,
      model: CLAUDE_SONNET,
      maxTokens: MAX_TOKENS,
      temperature: 0.3,
      feature: 'overnight_analyst',
      webSearch: { maxResults: MAX_WEB_RESULTS },
      // Search + synthesis is slow; give each hop room before the chain moves on.
      attemptTimeoutMs: 120_000,
    });
    const brief = (result.text ?? '').trim();

    if (!brief) {
      return NextResponse.json({
        error: 'LLM returned no text — brief not created',
        model: result.model,
        provider: result.provider,
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
        // Yesterday's market brief is dead news — expire, don't pile up.
        expiresAt: new Date(Date.now() + 24 * 3600_000),
        metadata: {
          source: 'cron_overnight_research',
          areas: areas.map((a) => a.postcode),
          model: result.model,
          provider: result.provider,
          viaFallback: result.viaFallback,
          dayBucket,
        },
      },
    });

    return NextResponse.json({
      success: true,
      actionId: action.id,
      areas: areas.map((a) => a.postcode),
      briefChars: brief.length,
      model: result.model,
      provider: result.provider,
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
