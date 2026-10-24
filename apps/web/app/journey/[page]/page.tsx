import {
  JOURNEY_STAND_INS,
  type JourneyStandIn,
} from '@/components/cookie-consent';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

/**
 * /journey/<name> — the stand-in a private journey page loads in a hidden
 * frame, so the ad and analytics tags can count "reached the offer letter"
 * without ever seeing the secret link (see the note at the top of
 * components/cookie-consent.tsx). The root layout's CookieConsent does the
 * work: it reads the visitor's saved choice and loads only the tags they
 * allowed, here on a public URL. The page itself shows nothing.
 *
 * The titles are what GA and Meta report as the page name.
 */
const TITLES: Record<JourneyStandIn, string> = {
  'offer-letter': 'Offer letter',
  'deal-timeline': 'Deal timeline',
  'viewing-booking': 'Viewing booking',
  'save-the-sale': 'Save the sale',
};

const isStandIn = (page: string): page is JourneyStandIn =>
  (Object.values(JOURNEY_STAND_INS) as string[]).includes(page);

export const generateStaticParams = () =>
  Object.values(JOURNEY_STAND_INS).map((page) => ({ page }));

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ page: string }>;
}): Promise<Metadata> {
  const { page } = await params;
  return {
    title: isStandIn(page) ? `${TITLES[page]} · Kept` : 'Kept',
    robots: { index: false, follow: false },
  };
}

export default async function JourneyStandInPage({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const { page } = await params;
  if (!isStandIn(page)) {
    notFound();
  }
  return null;
}
