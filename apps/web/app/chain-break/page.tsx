import { permanentRedirect } from 'next/navigation';

/**
 * /chain-break is preserved as a memorable URL but the canonical landing
 * is /save-the-sale, which covers the broader set of fall-through triggers
 * (mortgage refusal + survey down-valuations together account for 51% of
 * UK fall-throughs vs. chain breaks at 13%). Permanent (308) so any link
 * equity and printed collateral follow the canonical page.
 */
export default function ChainBreakRedirect() {
  permanentRedirect('/save-the-sale');
}
