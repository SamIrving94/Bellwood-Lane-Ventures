import { env } from '@/env';
import { database } from '@repo/database';
import { sendEmail } from '@repo/email';
import { getAgentsByPostcode } from '@repo/property-data';
import { NextResponse } from 'next/server';

/**
 * Weekly agent prospecting cron.
 *
 * Runs Mondays at 8am UTC. For each target postcode in
 * AGENT_PROSPECTING_POSTCODES (or the hardcoded fallback below), pulls
 * PropertyData's `/agents` endpoint — a ranked list of estate agents by
 * active listing volume.
 *
 * Each agent surfaced is upserted into the Contact table as
 * type='estate_agent'. New firms (not seen in any prior run) are flagged
 * via tags + counted into the run summary, which is then sent to Sam as
 * a Founder Action and an optional email.
 *
 * Cost: ~3 credits per postcode × N postcodes per week. At 20 postcodes
 * that's ~60 credits/week = ~240/month, well within the 5k plan.
 *
 * The actual outreach (email/WhatsApp campaigns) lives in /outreach in
 * apps/app — this cron just keeps the prospect list fresh.
 */

const FALLBACK_POSTCODES = [
  // Manchester / Stockport — primary patch
  'M14',
  'M19',
  'M20',
  'M21',
  'SK4',
  'SK5',
  'SK7',
  'SK8',
  // Leeds
  'LS1',
  'LS6',
  'LS8',
  'LS17',
  // Sheffield
  'S1',
  'S7',
  'S11',
  'S17',
];

const SOURCE_TAG = 'source:propertydata';

function targetPostcodes(): string[] {
  const fromEnv = env.AGENT_PROSPECTING_POSTCODES;
  if (fromEnv) {
    return fromEnv
      .split(',')
      .map((p) => p.trim().toUpperCase())
      .filter(Boolean);
  }
  return FALLBACK_POSTCODES;
}

type ProspectAgent = {
  postcode: string;
  name: string;
  phone?: string;
  address?: string;
  numberOfListings?: number;
  url?: string;
};

export const POST = async (request: Request) => {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = new Date();
  const postcodes = targetPostcodes();
  const surfaced: ProspectAgent[] = [];

  for (const postcode of postcodes) {
    const data = await getAgentsByPostcode(postcode);
    const agents = (data as { result?: { agents?: unknown[] } } | null)?.result
      ?.agents;
    if (!Array.isArray(agents)) continue;

    for (const raw of agents) {
      const a = raw as {
        name?: string;
        phone?: string;
        address?: string;
        number_of_listings?: number;
        url?: string;
      };
      if (!a.name) continue;
      surfaced.push({
        postcode,
        name: a.name.trim(),
        phone: a.phone?.trim(),
        address: a.address?.trim(),
        numberOfListings: a.number_of_listings,
        url: a.url?.trim(),
      });
    }
  }

  // Upsert into Contact table. We match on (name + postcode) - same firm
  // appearing in two postcodes counts as two records, which is right
  // because we'll outreach per-branch.
  let newCount = 0;
  let updatedCount = 0;
  for (const prospect of surfaced) {
    const existing = await database.contact.findFirst({
      where: {
        type: 'estate_agent',
        name: prospect.name,
        location: { contains: prospect.postcode, mode: 'insensitive' },
      },
    });

    const baseTags = [
      SOURCE_TAG,
      `postcode:${prospect.postcode}`,
      ...(typeof prospect.numberOfListings === 'number'
        ? [`listings:${prospect.numberOfListings}`]
        : []),
    ];

    if (existing) {
      // Refresh listing volume + url; preserve any human-added tags.
      const preservedTags = existing.tags.filter(
        (t) =>
          !t.startsWith('listings:') &&
          !t.startsWith('postcode:') &&
          t !== SOURCE_TAG,
      );
      await database.contact.update({
        where: { id: existing.id },
        data: {
          phone: prospect.phone ?? existing.phone,
          notes: prospect.url
            ? `${existing.notes ?? ''}\n[${startedAt.toISOString()}] Listing volume refresh: ${prospect.numberOfListings ?? '?'} active listings.`
                .trim()
                .slice(0, 1900)
            : existing.notes,
          tags: Array.from(new Set([...preservedTags, ...baseTags])),
        },
      });
      updatedCount++;
    } else {
      await database.contact.create({
        data: {
          type: 'estate_agent',
          name: prospect.name,
          phone: prospect.phone,
          location: prospect.address ?? prospect.postcode,
          notes: prospect.url
            ? `${prospect.numberOfListings ?? '?'} active listings.\nURL: ${prospect.url}`
            : `${prospect.numberOfListings ?? '?'} active listings.`,
          tags: [...baseTags, 'status:not_yet_contacted'],
        },
      });
      newCount++;
    }
  }

  // Top 5 newly surfaced firms by listing volume (most worth outreaching)
  const topNew = surfaced
    .filter((a) => typeof a.numberOfListings === 'number')
    .sort((a, b) => (b.numberOfListings ?? 0) - (a.numberOfListings ?? 0))
    .slice(0, 5);

  const summary = `Prospecting run scanned ${postcodes.length} postcodes, ` +
    `surfaced ${surfaced.length} agent records ` +
    `(${newCount} new, ${updatedCount} refreshed).`;

  // FounderAction so Sam sees the run in /actions
  try {
    const topNewLines = topNew
      .map(
        (a) =>
          `· ${a.name} (${a.postcode}) — ${a.numberOfListings ?? '?'} listings${
            a.phone ? ` — ${a.phone}` : ''
          }`,
      )
      .join('\n');
    await database.founderAction.create({
      data: {
        type: 'general',
        priority: 'medium',
        status: 'pending',
        agent: 'scout',
        title: `Weekly agent prospecting: ${newCount} new firm${newCount === 1 ? '' : 's'} surfaced`,
        description: `${summary}\n\nTop new firms by listing volume:\n${topNewLines || '(none new this run)'}\n\nReview in /contacts (filter type=estate_agent).`,
        metadata: {
          runDate: startedAt.toISOString(),
          postcodes,
          surfaced: surfaced.length,
          new: newCount,
          updated: updatedCount,
          link: '/contacts',
        },
      },
    });
  } catch (err) {
    console.warn('[agent-prospecting] founder-action create failed', err);
  }

  // Optional summary email
  const reportTo = env.AGENT_PROSPECTING_REPORT_EMAIL;
  if (reportTo && (newCount > 0 || updatedCount > 0)) {
    try {
      const topNewLines = topNew
        .map(
          (a) =>
            `- ${a.name} (${a.postcode}) — ${a.numberOfListings ?? '?'} listings${a.phone ? ` — ${a.phone}` : ''}`,
        )
        .join('\n');
      await sendEmail({
        to: reportTo,
        subject: `Weekly prospecting: ${newCount} new agent${newCount === 1 ? '' : 's'}`,
        text: [
          `Hi,`,
          ``,
          summary,
          ``,
          `Top new firms by listing volume:`,
          topNewLines || '(none new this run)',
          ``,
          `Open the dashboard to action: https://bellwood-app.vercel.app/contacts`,
          ``,
          `— Bellwoods scout`,
        ].join('\n'),
      });
    } catch (err) {
      console.warn('[agent-prospecting] summary email failed', err);
    }
  }

  return NextResponse.json({
    success: true,
    runDate: startedAt.toISOString(),
    postcodesScanned: postcodes.length,
    agentsSurfaced: surfaced.length,
    newCount,
    updatedCount,
    topNew,
  });
};
