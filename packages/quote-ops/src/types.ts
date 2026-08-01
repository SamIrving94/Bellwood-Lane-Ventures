/**
 * @repo/quote-ops — shared types for the signed-offer pipeline.
 *
 * These shapes are intentionally lightweight so the cron, the PDF renderer
 * and the server-action send-path can all agree on the data without dragging
 * the entire Prisma client surface into a client bundle.
 */

import type { DeepAppraisal } from '@repo/valuation';

/** Input to the PDF renderer. Cron supplies these from the QuoteRequest + re-AVM. */
export interface PdfInput {
  /** QuoteRequest id — used in the Blob path so we never overwrite a prior draft. */
  quoteId: string;
  address: string;
  postcode: string;
  agentFirmName?: string | null;
  agentContactName?: string | null;
  /** Re-run deep-appraisal output. The PDF reads ARV + bidCap + recommendation. */
  appraisal: DeepAppraisal;
  /** Best-effort PreflightChecks payload. Shape is wide on purpose. */
  enrichment?: unknown;
}

/** Input to the orchestrator that fires the email + records the timeline event. */
export interface SendSignedOfferInput {
  quoteId: string;
  signedOfferUrl: string;
  founderActionId: string;
}

/** Lightweight outcome that the server action can hand back to the UI. */
export interface SendSignedOfferResult {
  sent: boolean;
  emailSkipped: boolean;
  reason?: string;
  dealUpdateId?: string;
}
