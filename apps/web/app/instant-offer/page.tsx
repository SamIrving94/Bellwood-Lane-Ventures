import { permanentRedirect } from 'next/navigation';

// /instant-offer is the historic product URL (it appears in old collateral
// and emails). The site is split by audience now; the seller surface is the
// canonical successor. Permanent (308) so search equity follows. Sub-routes
// (methodology, offer/[id], the print docs) remain real pages.
export default function InstantOfferRedirect() {
  permanentRedirect('/sell');
}
