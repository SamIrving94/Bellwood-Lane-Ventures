import { env } from '@/env';
import { database } from '@repo/database';
import { NextResponse } from 'next/server';

// Training data export endpoint
// Exports founder feedback as JSONL for fine-tuning agent prompts
//
// GET /agents/export?type=scout_lead&since=2026-01-01&format=jsonl
export const GET = async (request: Request) => {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.PAPERCLIP_API_KEY}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const targetType = url.searchParams.get('type') ?? 'scout_lead';
  const since = url.searchParams.get('since');
  const format = url.searchParams.get('format') ?? 'jsonl';

  const where: Record<string, unknown> = {
    targetType,
  };
  if (since) {
    where.createdAt = { gte: new Date(since) };
  }

  const feedbackRecords = await database.founderFeedback.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  // Enrich each feedback with the target entity's data
  const trainingData = await Promise.all(
    feedbackRecords.map(async (fb) => {
      let agentOutput: Record<string, unknown> | null = null;

      switch (fb.targetType) {
        case 'scout_lead': {
          const lead = await database.scoutLead.findUnique({
            where: { id: fb.targetId },
          });
          if (lead) {
            agentOutput = {
              address: lead.address,
              postcode: lead.postcode,
              leadType: lead.leadType,
              leadScore: lead.leadScore,
              verdict: lead.verdict,
              estimatedEquityPence: lead.estimatedEquityPence,
              marketTrend: lead.marketTrend,
              source: lead.source,
            };
          }
          break;
        }
        case 'avm_result': {
          const avm = await database.avmResult.findUnique({
            where: { id: fb.targetId },
          });
          if (avm) {
            agentOutput = {
              postcode: avm.postcode,
              propertyType: avm.propertyType,
              riskScore: avm.riskScore,
              resultJson: avm.resultJson,
            };
          }
          break;
        }
        case 'deal': {
          const deal = await database.deal.findUnique({
            where: { id: fb.targetId },
            select: {
              address: true,
              postcode: true,
              propertyType: true,
              sellerType: true,
              status: true,
              askingPricePence: true,
              ourOfferPence: true,
              estimatedMarketValuePence: true,
              marginPercent: true,
              verdict: true,
            },
          });
          if (deal) {
            agentOutput = deal;
          }
          break;
        }
      }

      return {
        feedback_id: fb.id,
        target_type: fb.targetType,
        target_id: fb.targetId,
        agent_output: agentOutput,
        founder_feedback: {
          rating: fb.rating,
          overrides: fb.overrides,
          notes: fb.notes,
          marked_as_template: fb.markedAsTemplate,
        },
        created_at: fb.createdAt.toISOString(),
      };
    })
  );

  if (format === 'csv') {
    // Simple CSV export
    const headers = 'feedback_id,target_type,rating,has_overrides,notes,created_at';
    const rows = trainingData.map(
      (d) =>
        `${d.feedback_id},${d.target_type},${d.founder_feedback.rating},${d.founder_feedback.overrides ? 'yes' : 'no'},"${(d.founder_feedback.notes ?? '').replace(/"/g, '""')}",${d.created_at}`
    );
    const csv = [headers, ...rows].join('\n');

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="bellwood-training-${targetType}-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  }

  // JSONL format (default)
  const jsonl = trainingData.map((d) => JSON.stringify(d)).join('\n');

  return new Response(jsonl, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Content-Disposition': `attachment; filename="bellwood-training-${targetType}-${new Date().toISOString().split('T')[0]}.jsonl"`,
    },
  });
};
