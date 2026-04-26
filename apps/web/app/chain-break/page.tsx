import { redirect } from 'next/navigation';

/**
 * /chain-break is preserved as a memorable URL but the canonical landing
 * is /save-the-sale, which covers the broader set of fall-through triggers
 * (mortgage refusal + survey down-valuations together account for 51% of
 * UK fall-throughs vs. chain breaks at 13%).
 */
export default function ChainBreakRedirect() {
  redirect('/save-the-sale');
}
