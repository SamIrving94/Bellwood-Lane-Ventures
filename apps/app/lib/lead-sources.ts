import {
  LEAD_CHANNEL_LABELS,
  type LeadChannel,
  isLeadChannel,
} from '@repo/analytics/lead-source';

/**
 * "Where enquiries came from" on the Quotes page: the counts behind it.
 * Pure, so it is tested without a database (the reads are in
 * ./lead-source-queries). The source itself is read on the public site and
 * saved by the quote route (packages/analytics/lead-source.ts).
 *
 * Three numbers per source, because cheap enquiries are not the goal: how
 * many came in, how many accepted an offer, how many became a deal.
 */

export type LeadSourceRow = {
  channel: string;
  utmCampaign: string | null;
  utmContent: string | null;
  adCampaignId: string | null;
  status: string;
};

type Tally = { enquiries: number; accepted: number; deals: number };

export type ChannelSummary = Tally & { channel: LeadChannel; label: string };

export type AdvertSummary = Tally & {
  channel: LeadChannel;
  label: string;
  campaign: string;
  /** The ad's own name (utm_content). Null when only the campaign is known. */
  advert: string | null;
};

export type LeadSourceSummary = {
  channels: ChannelSummary[];
  adverts: AdvertSummary[];
  /**
   * Enquiries in the window with no usable source: sent before this was
   * switched on, or not through the public site.
   */
  notRecorded: number;
};

/** An accepted offer still counts once the quote has moved on to a deal. */
const ACCEPTED = new Set(['accepted', 'converted_to_deal']);

const add = (t: Tally, status: string) => {
  t.enquiries += 1;
  if (ACCEPTED.has(status)) {
    t.accepted += 1;
  }
  if (status === 'converted_to_deal') {
    t.deals += 1;
  }
};

const byEnquiries = (a: Tally, b: Tally) => b.enquiries - a.enquiries;

/**
 * `rows` are the saved sources in the window; `totalEnquiries` is every
 * enquiry in the same window, with or without one.
 */
export const summariseLeadSources = (
  rows: LeadSourceRow[],
  totalEnquiries: number
): LeadSourceSummary => {
  const channels = new Map<LeadChannel, ChannelSummary>();
  const adverts = new Map<string, AdvertSummary>();
  let recorded = 0;

  for (const row of rows) {
    // A channel this code no longer knows is not shown under a made-up name.
    if (!isLeadChannel(row.channel)) {
      continue;
    }
    recorded += 1;
    const channel = row.channel;
    const label = LEAD_CHANNEL_LABELS[channel];

    let c = channels.get(channel);
    if (!c) {
      c = { channel, label, enquiries: 0, accepted: 0, deals: 0 };
      channels.set(channel, c);
    }
    add(c, row.status);

    // Google's campaign number arrives on its own; a campaign NAME and the
    // advert's name only exist once the ad's link carries UTM tags.
    const campaign =
      row.utmCampaign ??
      (row.adCampaignId ? `Campaign ${row.adCampaignId}` : null);
    if (!campaign) {
      continue;
    }
    const advert = row.utmContent;
    const key = JSON.stringify([channel, campaign, advert]);
    let a = adverts.get(key);
    if (!a) {
      a = {
        channel,
        label,
        campaign,
        advert,
        enquiries: 0,
        accepted: 0,
        deals: 0,
      };
      adverts.set(key, a);
    }
    add(a, row.status);
  }

  return {
    channels: [...channels.values()].sort(byEnquiries),
    adverts: [...adverts.values()].sort(byEnquiries),
    notRecorded: Math.max(0, totalEnquiries - recorded),
  };
};
