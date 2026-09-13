import { database } from '@repo/database';
import { mergeScorerConfig, scoreLead } from '@repo/scouting';
import { parseWhatsAppMessage } from '@repo/whatsapp-parser';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { unauthorizedResponse, validateAgentAuth } from '../../_lib/auth';

const bodySchema = z.object({
  source: z.enum(['bridge', 'paste', 'share_sheet', 'email']),
  rawText: z.string().min(1),
  groupName: z.string().optional(),
  senderName: z.string().optional(),
  senderPhone: z.string().optional(),
  mediaUrls: z.array(z.string()).optional(),
  receivedAt: z.string().datetime().optional(),
});

// Map parser's sellerSituation enum -> ScoutLead.leadType string.
//
// Every value returned here must be a key of ScorerConfig.leadTypeScores so
// the scorer credits it: 'short_lease' and 'distressed' used to be stored
// verbatim and silently scored as the fallback (4 points) had they ever
// reached the scorer at all.
function mapLeadType(situation: string | undefined): string {
  switch (situation) {
    case 'probate':
    case 'chain_break':
    case 'repossession':
    case 'relocation':
      return situation;
    case 'short_lease':
      return 'lease_expiry';
    case 'distressed':
      return 'distressed_sale';
    default:
      return 'unknown';
  }
}

/**
 * Active founder-tuned scorer weights (EvalConfig 'lead_scoring'), same
 * lookup the scouting cron makes, so a WhatsApp lead and a scouted lead are
 * scored by one ruler. Falls back to the hard-coded defaults.
 */
async function loadScorerConfig() {
  try {
    const active = await database.evalConfig.findFirst({
      where: { evalType: 'lead_scoring', activatedAt: { not: null } },
      orderBy: { version: 'desc' },
      select: { version: true, config: true },
    });
    return {
      scorerConfig: mergeScorerConfig(active?.config ?? null),
      evalConfigVersion: active?.version ?? null,
    };
  } catch (err) {
    console.warn('[intake/whatsapp] failed to load scorer config', err);
    return { scorerConfig: mergeScorerConfig(null), evalConfigVersion: null };
  }
}

export const POST = async (request: Request) => {
  if (!validateAgentAuth(request)) return unauthorizedResponse();

  let parsedBody: z.infer<typeof bodySchema>;
  try {
    const json = await request.json();
    parsedBody = bodySchema.parse(json);
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Invalid request body',
        details: err instanceof z.ZodError ? err.errors : String(err),
      },
      { status: 400 }
    );
  }

  const {
    source,
    rawText,
    groupName,
    senderName,
    senderPhone,
    mediaUrls = [],
    receivedAt,
  } = parsedBody;

  // 1. Create intake record (pending)
  const intake = await database.whatsAppIntake.create({
    data: {
      source,
      rawText,
      groupName,
      senderName,
      senderPhone,
      mediaUrls,
      receivedAt: receivedAt ? new Date(receivedAt) : new Date(),
      parseStatus: 'pending',
    },
  });

  // 2. Parse with Claude (graceful without key)
  let parsed: Awaited<ReturnType<typeof parseWhatsAppMessage>>;
  let parseError: string | null = null;
  try {
    parsed = await parseWhatsAppMessage(rawText);
  } catch (err) {
    parsed = { confidence: 0, rawNotes: rawText };
    parseError = err instanceof Error ? err.message : String(err);
  }

  const hasAddress = Boolean(parsed.propertyAddress?.trim());
  const canAutoConvert = parsed.confidence >= 0.5 && hasAddress;

  let scoutLeadId: string | null = null;
  let founderActionId: string | null = null;
  let finalStatus: 'parsed' | 'manual_review' | 'failed';

  if (canAutoConvert) {
    // 3a. Create ScoutLead, scored by the SAME scorer as every other lead.
    //
    // This used to store parser confidence × 100 as the lead score — a
    // measure of how sure the model was that the message was a lead, on a
    // different scale from the scouting scorer, so WhatsApp leads were not
    // comparable to the rest of the inbox. Confidence still gates the
    // auto-convert above and is kept on rawPayload; the score is the
    // scorer's (lead type + whatever else the message gave us), with the
    // factor lines stamped so the lead page can show why.
    const { scorerConfig, evalConfigVersion } = await loadScorerConfig();
    const leadType = mapLeadType(parsed.sellerSituation);
    const address = parsed.propertyAddress ?? 'Unknown';
    const postcode = parsed.postcode ?? '';
    const breakdown = scoreLead(
      {
        probateRef: `whatsapp-${intake.id}`,
        address,
        postcode,
        leadType,
        grantDate: new Date().toISOString().slice(0, 10),
        grantType: 'unknown',
        daysSinceGrant: 0,
        goldenWindowLabel: 'cold',
        solicitorFirm: null,
        estateValuePence: parsed.askingPricePence ?? null,
        contactName: parsed.contactInfo?.name ?? null,
        contactPhone: parsed.contactInfo?.phone ?? senderPhone ?? null,
        contactEmail: parsed.contactInfo?.email ?? null,
        enrichmentTier: 3,
        sourceTrail: 'whatsapp_intake',
      },
      null,
      null,
      parsed.urgency === 'high'
        ? { motivation: { level: 'strong', signals: ['quick_sale_wanted'] } }
        : {},
      scorerConfig
    );

    const lead = await database.scoutLead.create({
      data: {
        runDate: new Date(),
        source: 'whatsapp_intake',
        address,
        postcode,
        leadType,
        estimatedEquityPence: null,
        contactName: parsed.contactInfo?.name,
        contactPhone: parsed.contactInfo?.phone ?? senderPhone,
        contactEmail: parsed.contactInfo?.email,
        leadScore: breakdown.total,
        verdict: breakdown.verdict,
        evalConfigVersion,
        rawPayload: JSON.parse(
          JSON.stringify({
            ...parsed,
            parserConfidence: parsed.confidence,
            riskFlags: breakdown.riskFlags,
            rationale: breakdown.rationale,
            scoreFactors: breakdown.factors,
            leadingIndicator: breakdown.leadingIndicator,
            scoreBreakdown: {
              acquisition: breakdown.acquisition,
              roi: breakdown.roi,
              marketTrend: breakdown.marketTrend,
              risk: breakdown.risk,
              total: breakdown.total,
              appraised: breakdown.appraised,
              sourcingScore: breakdown.sourcingScore,
              achievablePoints: breakdown.achievablePoints,
            },
          })
        ),
        status: 'new',
      },
    });
    scoutLeadId = lead.id;
    finalStatus = 'parsed';
  } else {
    // 3b. Queue for manual review via FounderAction
    const snippet = rawText.slice(0, 50).replace(/\s+/g, ' ').trim();
    const action = await database.founderAction.create({
      data: {
        type: 'review_leads',
        priority: 'medium',
        title: `WhatsApp intake needs review: ${snippet}${rawText.length > 50 ? '...' : ''}`,
        description: `A WhatsApp message was received but Claude could not extract enough structured data to auto-create a lead (confidence=${parsed.confidence.toFixed(2)}, hasAddress=${hasAddress}). Review the raw text and create a lead manually if appropriate.`,
        agent: 'scout',
        metadata: {
          intakeId: intake.id,
          source,
          groupName,
          senderName,
          parsed,
        },
      },
    });
    founderActionId = action.id;
    finalStatus = parseError ? 'failed' : 'manual_review';
  }

  // 4. Update intake with parse result
  await database.whatsAppIntake.update({
    where: { id: intake.id },
    data: {
      parsedFields: parsed as unknown as object,
      parsedConfidence: parsed.confidence,
      parseStatus: finalStatus,
      parseError,
      scoutLeadId,
      founderActionId,
      processedAt: new Date(),
    },
  });

  // 5. AgentEvent
  await database.agentEvent.create({
    data: {
      agent: 'scout',
      eventType: 'whatsapp_intake_received',
      summary: scoutLeadId
        ? `WhatsApp intake parsed into ScoutLead (confidence ${parsed.confidence.toFixed(2)})`
        : `WhatsApp intake queued for manual review (confidence ${parsed.confidence.toFixed(2)})`,
      payload: {
        intakeId: intake.id,
        source,
        groupName,
        senderName,
        scoutLeadId,
        founderActionId,
        confidence: parsed.confidence,
        parseStatus: finalStatus,
      },
    },
  });

  return NextResponse.json({
    intakeId: intake.id,
    scoutLeadId,
    founderActionId,
    parseStatus: finalStatus,
  });
};
