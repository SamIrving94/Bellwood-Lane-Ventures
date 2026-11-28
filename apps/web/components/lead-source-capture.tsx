'use client';

import { captureLeadSource } from '@/lib/lead-source';
import { useEffect } from 'react';

// Read as this module loads, which is the first page of the visit: the
// address still carries the ad's tags then. An effect alone could run after a
// client-side redirect had already moved on and dropped them.
captureLeadSource();

/**
 * Mounted once in the root layout so every landing page is covered, not just
 * the ones with a form on them. A visitor who lands on the home page from an
 * advert and fills in the form on /sell keeps the advert as their source.
 * Renders nothing. See lib/lead-source.ts.
 */
export function LeadSourceCapture() {
  useEffect(() => {
    captureLeadSource();
  }, []);
  return null;
}
