/**
 * `notifiedBy` value on the timeline event a person writes when they approve
 * and send the signed offer (quote-ops sendSignedOffer). It is the ONLY event
 * that may reveal the offer figure to a seller: the founder rule is no figure
 * before a viewing, and every offer is checked by a person first. The track
 * page keys its offer card off it.
 *
 * Kept in its own dependency-free module so callers that only need the
 * constant (the ChatGPT plugin) do not load the database client.
 */
export const SIGNED_OFFER_NOTIFIER = 'quote-ops:approve-and-send';
