import { env } from '@/env';
import { database } from '@repo/database';
import { runAVM } from '@repo/valuation';
import { NextResponse } from 'next/server';

// Pipeline Stage 2: Auto-appraise top leads (7:15am daily)
// Finds leads scored >= 70 with no existing AVM, runs valuation, pushes results
export const POST = async (request: Request) => {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const pipelineRunId = `run_${Date.now()}`;

  // Find high-scoring leads from today that have been converted to deals
  // OR deals in 'new_lead' or 'valuation' stage with no AVM result
  const dealsNeedingValuation = await database.deal.findMany({
    where: {
      status: { in: ['new_lead', 'contacted', 'valuation'] },
      avmResults: { none: {} },
    },
    select: {
      id: true,
      address: true,
      postcode: true,
      propertyType: true,
      bedrooms: true,
      sellerType: true,
    },
    take: 10, // Cap per run to avoid timeouts
  });

  // Also find unconverted high-scoring leads without deals
  const topLeads = await database.scoutLead.findMany({
    where: {
      leadScore: { gte: 70 },
      status: 'new',
      convertedDealId: null,
    },
    orderBy: { leadScore: 'desc' },
    take: 5,
    select: {
      id: true,
      address: true,
      postcode: true,
      leadType: true,
    },
  });

  const results: Array<{
    type: string;
    id: string;
    address: string;
    riskScore: number;
    verdict: string;
    offerPence?: number;
    error?: string;
  }> = [];

  // Appraise deals
  for (const deal of dealsNeedingValuation) {
    try {
      // Map property type string to AVM enum
      const propertyTypeMap: Record<string, string> = {
        detached: 'detached',
        'semi-detached': 'semi-detached',
        semi: 'semi-detached',
        terraced: 'terraced',
        terrace: 'terraced',
        flat: 'flat',
        apartment: 'flat',
        bungalow: 'detached',
      };
      const avmPropertyType = propertyTypeMap[deal.propertyType.toLowerCase()] ?? 'terraced';

      // Map seller type
      const sellerTypeMap: Record<string, string> = {
        probate: 'probate',
        chain_break: 'chain_break',
        short_lease: 'short_lease',
        repossession: 'repossession',
        relocation: 'relocation',
        standard: 'standard',
      };
      const avmSellerType = sellerTypeMap[deal.sellerType] ?? 'standard';

      const avmResult = await runAVM({
        postcode: deal.postcode,
        propertyType: avmPropertyType as any,
        address: deal.address,
        bedrooms: deal.bedrooms ?? undefined,
        sellerType: avmSellerType as any,
        dealId: deal.id,
      });

      // Store AVM result
      await database.avmResult.create({
        data: {
          dealId: deal.id,
          postcode: avmResult.postcode,
          propertyType: avmResult.propertyType,
          riskScore: avmResult.riskScore,
          resultJson: avmResult.resultJson as any,
          expiresAt: avmResult.expiresAt,
        },
      });

      // Update deal with valuation data
      const resultJson = avmResult.resultJson;
      await database.deal.update({
        where: { id: deal.id },
        data: {
          estimatedMarketValuePence: resultJson.avmPointEstimate,
          ourOfferPence: resultJson.finalOffer,
          marginPercent: resultJson.baseAcquisitionMargin * 100,
          verdict: resultJson.requiresCeoEscalation ? 'THIN' :
                   resultJson.confidenceLevel === 'high' ? 'STRONG' : 'VIABLE',
        },
      });

      // Log deal activity
      await database.dealActivity.create({
        data: {
          dealId: deal.id,
          action: 'avm_completed',
          detail: `Auto-valuation: risk ${avmResult.riskScore}/100, offer ${(resultJson.finalOffer / 100).toLocaleString('en-GB', { style: 'currency', currency: 'GBP' })}`,
        },
      });

      // Create FounderAction
      const actionType = resultJson.requiresCeoEscalation ? 'ceo_escalation' : 'approve_offer';
      const actionPriority = resultJson.requiresCeoEscalation ? 'critical' : 'medium';

      await database.founderAction.create({
        data: {
          type: actionType as any,
          priority: actionPriority as any,
          title: resultJson.requiresCeoEscalation
            ? `CEO escalation: offer < 60% AVM on ${deal.address}`
            : `Approve offer on ${deal.address} — ${(resultJson.finalOffer / 100).toLocaleString('en-GB', { style: 'currency', currency: 'GBP' })} (margin ${(resultJson.baseAcquisitionMargin * 100).toFixed(1)}%)`,
          description: `Auto-valuation complete. Risk: ${avmResult.riskScore}/100. ${resultJson.preRicsFlags.length > 0 ? `Pre-RICS flags: ${resultJson.preRicsFlags.join(', ')}` : 'No pre-RICS flags.'}`,
          agent: 'appraiser',
          dealId: deal.id,
          metadata: {
            riskScore: avmResult.riskScore,
            estimatedValue: resultJson.avmPointEstimate,
            finalOffer: resultJson.finalOffer,
            marginPercent: resultJson.baseAcquisitionMargin * 100,
            preRicsFlags: resultJson.preRicsFlags,
          },
        },
      });

      results.push({
        type: 'deal',
        id: deal.id,
        address: deal.address,
        riskScore: avmResult.riskScore,
        verdict: resultJson.requiresCeoEscalation ? 'CEO_ESCALATION' : 'OK',
        offerPence: resultJson.finalOffer,
      });
    } catch (error) {
      results.push({
        type: 'deal',
        id: deal.id,
        address: deal.address,
        riskScore: 0,
        verdict: 'ERROR',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Log agent event for the run
  const successCount = results.filter((r) => r.verdict !== 'ERROR').length;
  await database.agentEvent.create({
    data: {
      agent: 'appraiser',
      eventType: 'pipeline_appraise',
      summary: `Auto-appraised ${successCount}/${dealsNeedingValuation.length} deals${topLeads.length > 0 ? `, ${topLeads.length} top leads pending conversion` : ''}`,
      count: successCount,
      pipelineRunId,
      payload: { results, topLeadsSkipped: topLeads.length },
    },
  });

  return NextResponse.json({
    success: true,
    pipelineRunId,
    appraised: successCount,
    errors: results.filter((r) => r.verdict === 'ERROR').length,
    topLeadsPendingConversion: topLeads.length,
    results,
  });
};
