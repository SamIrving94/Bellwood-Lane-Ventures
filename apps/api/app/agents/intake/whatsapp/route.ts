import { database } from '@repo/database';
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

// Map parser's sellerSituation enum -> ScoutLead.leadType string
function mapLeadType(
  situation: string | undefined
): string {
  switch (situation) {
    case 'probate':
    case 'chain_break':
    case 'repossession':
    case 'relocation':
    case 'short_lease':
      return situation;
    case 'distressed':
      return 'distressed';
    default:
      return 'whatsapp_intake';
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
    // 3a. Create ScoutLead
    // Map parser confidence (0-1) into a lead score (0-100)
    const leadScore = Math.round(parsed.confidence * 100);
    const verdict =
      leadScore >= 80
        ? 'STRONG'
        : leadScore >= 60
          ? 'VIABLE'
          : leadScore >= 40
            ? 'THIN'
            : 'INSUFFICIENT_DATA';

    const lead = await database.scoutLead.create({
      data: {
        runDate: new Date(),
        source: 'whatsapp_intake',
        address: parsed.propertyAddress ?? 'Unknown',
        postcode: parsed.postcode ?? '',
        leadType: mapLeadType(parsed.sellerSituation),
        estimatedEquityPence: null,
        contactName: parsed.contactInfo?.name,
        contactPhone: parsed.contactInfo?.phone ?? senderPhone,
        contactEmail: parsed.contactInfo?.email,
        leadScore,
        verdict,
        rawPayload: parsed as unknown as object,
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
