import { database } from '@repo/database';
import type { LeadSourceRow } from './lead-sources';

/**
 * The dashboard's reads of QuoteRequestSource (which advert, search or site
 * brought each enquiry). Kept apart from ./lead-sources so that file stays
 * pure and testable without a database.
 *
 * Every read returns null instead of throwing. The table arrives with a
 * manual `pnpm migrate`, and the Quotes pages must keep working before that
 * has run: null means "sources are not switched on yet", and the pages say so.
 */
const orNull = async <T>(
  what: string,
  read: () => Promise<T>
): Promise<T | null> => {
  try {
    return await read();
  } catch (err) {
    console.warn(`[lead-source] ${what} unavailable`, err);
    return null;
  }
};

/** Rows for the "Where enquiries came from" summary. Never contact details. */
export const loadSourceRows = (since: Date) =>
  orNull('summary', async (): Promise<LeadSourceRow[]> => {
    const rows = await database.quoteRequestSource.findMany({
      where: { createdAt: { gte: since } },
      select: {
        channel: true,
        utmCampaign: true,
        utmContent: true,
        adCampaignId: true,
        quoteRequest: { select: { status: true } },
      },
    });
    return rows.map(({ quoteRequest, ...source }) => ({
      ...source,
      status: quoteRequest.status,
    }));
  });

/** Channel per enquiry, for the chip on each row of the Quotes list. */
export const loadChannels = (quoteRequestIds: string[]) =>
  orNull('channels', async () => {
    const rows = await database.quoteRequestSource.findMany({
      where: { quoteRequestId: { in: quoteRequestIds } },
      select: { quoteRequestId: true, channel: true },
    });
    return new Map(rows.map((r) => [r.quoteRequestId, r.channel]));
  });

/** One enquiry's source, for its detail page. Null when none was saved. */
export const loadSource = (quoteRequestId: string) =>
  orNull('source', () =>
    database.quoteRequestSource.findUnique({ where: { quoteRequestId } })
  );
