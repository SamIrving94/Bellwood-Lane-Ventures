import { z } from 'zod';
import { fetchPropertyData } from '../client';

// ---------------------------------------------------------------------------
// Endpoint: /account/credits — budget visibility
// ---------------------------------------------------------------------------

const CreditsSchema = z.object({
  status: z.string().optional(),
  result: z
    .object({
      credits_used: z.number().optional(),
      credits_remaining: z.number().optional(),
      credits_total: z.number().optional(),
      plan: z.string().optional(),
      reset_date: z.string().optional(),
    })
    .partial()
    .optional(),
});

/**
 * Account credit balance. Free to call (PropertyData doesn't bill for this).
 * Refreshed every 60s in the dashboard so the credit panel stays accurate
 * without thrashing the endpoint.
 */
export async function getAccountCredits() {
  return fetchPropertyData('/account/credits', {}, {
    ttlMs: 60 * 1000, // 1 minute
    estimatedCredits: 0,
    schema: CreditsSchema,
  });
}

