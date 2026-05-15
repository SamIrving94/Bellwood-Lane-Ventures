import { database } from '@repo/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validateAgentAuth, unauthorizedResponse } from '../_lib/auth';

// Permissive lead schema — accepts hand-crafted Paperclip payloads as well as
// pipeline-shaped objects. Missing fields are defaulted; structurally bad
// rows are rejected with a per-row error rather than failing the whole batch.
const LeadInput = z.object({
  runDate: z
    .string()
    .datetime()
    .optional()
    .transform((s) => (s ? new Date(s) : new Date())),
  source: z.string().min(1).default('paperclip-manual'),
  address: z.string().min(3),
  postcode: z.string().min(2).transform((s) => s.toUpperCase().trim()),
  leadType: z.string().default('unknown'),
  estimatedEquityPence: z.number().int().optional().nullable(),
  contactName: z.string().optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  contactEmail: z.string().email().optional().nullable(),
  leadScore: z.number().int().min(0).max(100).default(50),
  verdict: z
    .enum(['STRONG', 'VIABLE', 'THIN', 'PASS', 'INSUFFICIENT_DATA'])
    .default('VIABLE'),
  marketTrend: z.string().optional().nullable(),
  sourceTrail: z.string().optional().nullable(),
  rawPayload: z.record(z.string(), z.unknown()).optional().nullable(),
  status: z.string().default('new'),
});

const Body = z.object({
  leads: z.array(z.unknown()).min(1),
  runSummary: z
    .object({
      summary: z.string().optional(),
      fetched: z.number().optional(),
      enriched: z.number().optional(),
    })
    .optional(),
});

/**
 * POST /agents/leads
 *
 * Scout / CEO / manual replay pushes verified leads into the platform.
 * Per-row validation: bad rows are surfaced in `rejected`, good rows
 * are inserted with `skipDuplicates`. Dashboard /Today picks them up
 * via FounderAction if any score ≥ 70.
 */
export const POST = async (request: Request) => {
  if (!validateAgentAuth(request)) return unauthorizedResponse();

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const accepted: z.infer<typeof LeadInput>[] = [];
  const rejected: Array<{ index: number; address?: string; reason: string }> = [];

  parsed.data.leads.forEach((row, i) => {
    const result = LeadInput.safeParse(row);
    if (result.success) {
      accepted.push(result.data);
    } else {
      const addr =
        row && typeof row === 'object' && 'address' in row
          ? String((row as Record<string, unknown>).address)
          : undefined;
      rejected.push({
        index: i,
        address: addr,
        reason: result.error.issues
          .map((e) => `${e.path.join('.')}: ${e.message}`)
          .join('; ')
          .slice(0, 300),
      });
    }
  });

  if (accepted.length === 0) {
    return NextResponse.json(
      {
        error: 'No valid leads in payload',
        rejected,
      },
      { status: 400 },
    );
  }

  const created = await database.scoutLead.createMany({
    data: accepted.map((l) => ({
      runDate: l.runDate,
      source: l.source,
      address: l.address,
      postcode: l.postcode,
      leadType: l.leadType,
      estimatedEquityPence: l.estimatedEquityPence ?? null,
      contactName: l.contactName ?? null,
      contactPhone: l.contactPhone ?? null,
      contactEmail: l.contactEmail ?? null,
      leadScore: l.leadScore,
      verdict: l.verdict,
      marketTrend: l.marketTrend ?? null,
      sourceTrail: l.sourceTrail ?? null,
      rawPayload: (l.rawPayload ?? undefined) as never,
      status: l.status,
    })),
    skipDuplicates: true,
  });

  const highScoreLeads = accepted.filter((l) => l.leadScore >= 70);
  const strongLeads = accepted.filter((l) => l.verdict === 'STRONG');

  const summary =
    parsed.data.runSummary?.summary ??
    `Scout posted ${accepted.length} leads (${strongLeads.length} STRONG, ${highScoreLeads.length} scored 70+)${rejected.length ? `; ${rejected.length} rejected` : ''}`;

  const event = await database.agentEvent.create({
    data: {
      agent: 'scout',
      eventType: 'leads_created',
      summary,
      count: accepted.length,
      payload: {
        total: accepted.length,
        strong: strongLeads.length,
        highScore: highScoreLeads.length,
        rejected: rejected.length,
        fetched: parsed.data.runSummary?.fetched,
        enriched: parsed.data.runSummary?.enriched,
      },
    },
  });

  if (highScoreLeads.length > 0) {
    const leadSample = highScoreLeads
      .slice(0, 5)
      .map((l) => `${l.address}, ${l.postcode} (${l.leadScore})`);
    await database.founderAction.create({
      data: {
        type: 'review_leads',
        priority: highScoreLeads.length >= 5 ? 'high' : 'medium',
        title: `Review ${highScoreLeads.length} new lead${highScoreLeads.length === 1 ? '' : 's'} scored 70+`,
        description: `Scout posted ${accepted.length} leads. ${strongLeads.length} STRONG, ${highScoreLeads.length} scored ≥ 70. Open Pipeline → Leads to review and convert the best.`,
        agent: 'scout',
        agentEventId: event.id,
        metadata: {
          source: 'agent_post_leads',
          assignedToAgent: 'board',
          leadCount: highScoreLeads.length,
          strongCount: strongLeads.length,
          runDate: new Date().toISOString(),
          leadSample,
          link: '/pipeline?tab=leads',
        },
      },
    });

    // Also push to Marketer
    await database.founderAction.create({
      data: {
        type: 'dispatch_campaign',
        priority: 'medium',
        title: `Draft outreach for ${highScoreLeads.length} new high-scoring lead${highScoreLeads.length === 1 ? '' : 's'}`,
        description: `Scout posted ${highScoreLeads.length} leads scored ≥ 70 (${strongLeads.length} STRONG). For each, draft a first-touch email tailored to the leadType. Hold drafts for board approval. Top examples: ${leadSample.slice(0, 3).join(' | ')}.`,
        agent: 'marketer',
        agentEventId: event.id,
        metadata: {
          source: 'agent_post_leads',
          assignedToAgent: 'marketer',
          workflow: 'draft_outreach_for_new_leads',
          leadCount: highScoreLeads.length,
          link: '/pipeline?tab=leads',
        },
      },
    });
  }

  return NextResponse.json({
    success: true,
    created: created.count,
    rejected,
    highScoreLeads: highScoreLeads.length,
    strongLeads: strongLeads.length,
    eventId: event.id,
  });
};
