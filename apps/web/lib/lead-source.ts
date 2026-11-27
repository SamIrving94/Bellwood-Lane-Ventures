import { isPrivatePath } from '@/components/cookie-consent';
import { type LeadSource, readLeadSource } from '@repo/analytics/lead-source';

/**
 * This visit's source (which advert, search or site brought the person),
 * read once from the first page and sent with whichever form they fill in.
 * The quote route saves it on the enquiry, so the dashboard can say where
 * each one came from. What is read, and what never is, is set out in
 * packages/analytics/lead-source.ts.
 *
 * Held in memory only: no cookie, no sessionStorage. That keeps it on the
 * same footing as PostHog's memory-only id (app/layout.tsx): nothing is
 * stored on the visitor's device, so it does not sit behind the cookie
 * banner. The cost is that a full page reload forgets it. The enquiry is
 * then saved as "not known", never guessed.
 */
let source: LeadSource | undefined;

export const captureLeadSource = (): void => {
  if (source || typeof window === 'undefined') {
    return;
  }
  source = readLeadSource({
    url: window.location.href,
    referrer: document.referrer,
    isPrivatePath,
  });
};

/** For a form's POST body. Undefined on the server. */
export const leadSource = (): LeadSource | undefined => {
  captureLeadSource();
  return source;
};
