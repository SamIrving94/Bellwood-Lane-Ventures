import { redirect } from 'next/navigation';

// /instant-offer is the historic URL — site is now split by audience.
// Default to the agent-first surface; sellers go via /sell.
export default function InstantOfferRedirect() {
  redirect('/agents');
}
