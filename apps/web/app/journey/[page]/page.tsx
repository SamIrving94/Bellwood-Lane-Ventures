import {
  JOURNEY_STAND_INS,
  type JourneyStandIn,
} from '@/lib/journey-stand-ins';
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

const STAND_INS: string[] = Object.values(JOURNEY_STAND_INS);

const isStandIn = (page: string): page is JourneyStandIn =>
  STAND_INS.includes(page);

/**
 * These names are the only pages this route has (dynamicParams is false),
 * so an empty list means every stand-in 404s. That happened, unnoticed, for
 * a month (see lib/journey-stand-ins.ts): stop the build instead.
 */
export const generateStaticParams = () => {
  if (STAND_INS.length === 0) {
    throw new Error(
      'journey: no stand-in names. JOURNEY_STAND_INS must come from a plain module, not a "use client" file.'
    );
  }
  return STAND_INS.map((page) => ({ page }));
};

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
