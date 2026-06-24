import { env } from '@/env';
import { database } from '@repo/database';
import { sendEmail } from '@repo/email';
import { log } from '@repo/observability/log';
import { NextResponse } from 'next/server';
import { recordCronHeartbeat } from '../_lib/heartbeat';

// Pipeline Stage 3: Auto-outreach (7:30am daily)
// Sends comms to estate agents and solicitors. HOLDS vendor comms for founder review.
//
// CRITICAL RULE: Direct vendor emails are NEVER auto-sent.
// They are placed in OutreachHold for founder review.
export const POST = async (request: Request) => {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const pipelineRunId = `run_${Date.now()}`;

  // Find active campaigns with pending recipients
  const activeCampaigns = await database.outreachCampaign.findMany({
    where: { status: 'active' },
    include: {
      recipients: {
        where: { status: 'pending' },
        include: { contact: true },
      },
    },
  });

  let autoSent = 0;
  let heldForReview = 0;
  let skipped = 0;
  let sendFailures = 0;
  // Per-send results keyed by recipient id — surfaced via AgentEvent.payload so
  // the Resend message ids are recoverable without a schema migration.
  const sendResults: Array<{
    recipientId: string;
    campaignId: string;
    to: string;
    messageId?: string;
    skipped?: string;
    error?: string;
  }> = [];

  // Find templates for active campaigns
  for (const campaign of activeCampaigns) {
    if (campaign.templateIds.length === 0) continue;

    // Get the first template for now (sequence = 1)
    const template = await database.outreachTemplate.findFirst({
      where: { id: { in: campaign.templateIds } },
      orderBy: { sequence: 'asc' },
    });

    if (!template) continue;

    for (const recipient of campaign.recipients) {
      const contact = recipient.contact;

      // Classify recipient type
      const isIndividual = ['vendor', 'seller', 'individual'].includes(
        contact.type.toLowerCase()
      );

      // Render template (basic variable substitution)
      const renderedSubject = template.subject
        .replace(/\{\{name\}\}/g, contact.name)
        .replace(/\{\{company\}\}/g, contact.company ?? '');
      const renderedBody = template.body
        .replace(/\{\{name\}\}/g, contact.name)
        .replace(/\{\{company\}\}/g, contact.company ?? '')
        .replace(/\{\{location\}\}/g, contact.location ?? '');

      if (!contact.email) {
        skipped++;
        continue;
      }

      if (isIndividual) {
        // HOLD — vendor comms always need founder review.
        //
        // Atomically claim the recipient (pending → held) BEFORE creating the
        // hold. The conditional updateMany is the idempotency guard: if a
        // concurrent run or a Vercel retry already processed this recipient,
        // `count` is 0 and we skip — so we never create a duplicate
        // OutreachHold for the same vendor. (Previously the recipient was left
        // `pending`, so every run re-held the same vendor.)
        const claim = await database.outreachRecipient.updateMany({
          where: { id: recipient.id, status: 'pending' },
          data: { status: 'held' },
        });
        if (claim.count === 0) {
          continue;
        }

        await database.outreachHold.create({
          data: {
            recipientId: recipient.id,
            campaignId: campaign.id,
            templateId: template.id,
            recipientType: 'individual',
            recipientName: contact.name,
            recipientEmail: contact.email,
            renderedSubject,
            renderedBody,
            status: 'held',
          },
        });

        heldForReview++;
      } else {
        // AUTO-SEND — B2B comms to agents and solicitors.
        //
        // Atomically claim the recipient (pending → sending) BEFORE dispatch.
        // The conditional updateMany is the idempotency guard: a Vercel retry
        // mid-batch (or a concurrent run) cannot double-send, because only one
        // caller can flip the row out of `pending`.
        const claim = await database.outreachRecipient.updateMany({
          where: { id: recipient.id, status: 'pending' },
          data: { status: 'sending' },
        });
        if (claim.count === 0) {
          continue;
        }

        try {
          const result = await sendEmail({
            to: contact.email,
            subject: renderedSubject,
            text: renderedBody,
          });

          if (result.skipped) {
            sendResults.push({
              recipientId: recipient.id,
              campaignId: campaign.id,
              to: contact.email,
              skipped: result.reason,
            });
            // Still advance recipient — the skip is intentional (no token in
            // dev/staging). In production this branch shouldn't hit.
          } else {
            sendResults.push({
              recipientId: recipient.id,
              campaignId: campaign.id,
              to: contact.email,
              messageId: result.messageId,
            });
          }

          await database.outreachRecipient.update({
            where: { id: recipient.id },
            data: {
              status: 'sent',
              lastSentAt: new Date(),
              currentStep: recipient.currentStep + 1,
            },
          });

          autoSent++;
        } catch (err) {
          sendFailures++;
          const message = err instanceof Error ? err.message : String(err);
          log.error('pipeline-outreach: send failed', {
            recipientId: recipient.id,
            campaignId: campaign.id,
            to: contact.email,
            error: message,
          });
          sendResults.push({
            recipientId: recipient.id,
            campaignId: campaign.id,
            to: contact.email,
            error: message,
          });
          // Revert the claim (sending → pending) so the next run retries.
          await database.outreachRecipient.updateMany({
            where: { id: recipient.id, status: 'sending' },
            data: { status: 'pending' },
          });
        }
      }
    }
  }

  // Create FounderAction if there are held vendor comms
  if (heldForReview > 0) {
    await database.founderAction.create({
      data: {
        type: 'review_campaign',
        priority: 'high',
        title: `${heldForReview} vendor email${heldForReview === 1 ? '' : 's'} awaiting your review`,
        description: `The outreach pipeline has ${heldForReview} email${heldForReview === 1 ? '' : 's'} to individual vendors that need your review before sending. These are personal communications that require the human touch.\n\nAuto-sent: ${autoSent} (to estate agents/solicitors)\nSkipped: ${skipped} (no email address)`,
        agent: 'marketer',
        metadata: {
          heldForReview,
          autoSent,
          skipped,
          pipelineRunId,
        },
      },
    });
  }

  // Log agent event — include per-send results (incl. Resend message ids) in
  // the payload so they're recoverable without a schema change.
  await database.agentEvent.create({
    data: {
      agent: 'marketer',
      eventType: 'pipeline_outreach',
      summary: `Outreach: ${autoSent} auto-sent, ${heldForReview} held for review, ${skipped} skipped, ${sendFailures} failed`,
      count: autoSent + heldForReview,
      pipelineRunId,
      payload: {
        autoSent,
        heldForReview,
        skipped,
        sendFailures,
        campaigns: activeCampaigns.length,
        sendResults,
      },
    },
  });

  await recordCronHeartbeat('pipeline-outreach', { runId: pipelineRunId });

  return NextResponse.json({
    success: true,
    pipelineRunId,
    autoSent,
    heldForReview,
    skipped,
    sendFailures,
    campaignsProcessed: activeCampaigns.length,
  });
};

// Vercel cron sends GET by default. Accept either method so a manual
// POST and an automated GET both reach the same handler.
export const GET = POST;
