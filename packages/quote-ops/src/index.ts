/**
 * @repo/quote-ops
 *
 * 4-hour SLA quote-ops orchestration. Replaces what Paperclip's Appraiser
 * was supposed to do: PDF draft + signed-offer email + DealUpdate write.
 */

export { renderSignedOfferPdf } from './render-pdf';
export { sendSignedOffer } from './send-signed-offer';
export type {
  PdfInput,
  SendSignedOfferInput,
  SendSignedOfferResult,
} from './types';
