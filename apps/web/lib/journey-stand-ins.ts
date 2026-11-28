/**
 * Private journey pages and the stand-in address their tags report instead
 * (the design is described at the top of components/cookie-consent.tsx).
 * The names are what the ad manager types into audience rules ("URL
 * contains /journey/offer-letter"), so don't rename one without telling them.
 *
 * This is a plain module on purpose: keep it out of any 'use client' file.
 * A server file that imports a value from a client file gets an empty
 * placeholder, not the value. The list used to live in cookie-consent.tsx,
 * so the /journey/[page] route (a server file) saw no names and built no
 * pages: every stand-in 404'd on the live site from 24 Oct to 27 Nov 2026.
 * The banner and the route both import from here now.
 */
export const JOURNEY_STAND_INS = {
  '/instant-offer/offer': 'offer-letter',
  '/track': 'deal-timeline',
  '/viewing': 'viewing-booking',
  '/save-the-sale': 'save-the-sale',
} as const;

export type JourneyStandIn =
  (typeof JOURNEY_STAND_INS)[keyof typeof JOURNEY_STAND_INS];

export const journeyStandIn = (path: string): JourneyStandIn | null => {
  for (const [p, name] of Object.entries(JOURNEY_STAND_INS)) {
    if (path === p || path.startsWith(`${p}/`)) {
      return name;
    }
  }
  return null;
};
