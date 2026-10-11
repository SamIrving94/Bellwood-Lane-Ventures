'use server';

import { CLAUDE_SONNET, callClaudeForObject } from '@repo/ai/claude';
import { requireFounder } from '@repo/auth/server';
import { database } from '@repo/database';
import { sendEmail } from '@repo/email';
import { put } from '@repo/storage';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { renderPackEmail } from '@/lib/investor-pack-email';

/**
 * Investor packs, Phase 1 of the back-to-back workflow (founder decision,
 * 10 Oct 2026): once a price is agreed with the seller we build a pack, send
 * it to the investor list, and investors register interest at a FIXED price
 * (seller price + our fee) for two weeks. No bidding.
 *
 * Steps vs Thoughts: the AI drafts the copy, the founder edits it, and only
 * the founder's click sends anything. Nothing here runs on a schedule.
 */

const WINDOW_DAYS = 14;
const MAX_IMAGES = 24;

const poundsToPence = (n: number) => Math.round(n * 100);

const optionalPounds = z
  .number()
  .nonnegative()
  .nullable()
  .optional()
  .transform((v) => (v === null || v === undefined ? null : poundsToPence(v)));

const blobUrl = z
  .string()
  .url()
  .refine((u) => {
    try {
      return new URL(u).hostname.endsWith('.vercel-storage.com');
    } catch {
      return false;
    }
  }, 'Images must be uploaded here, not linked from elsewhere.');

const packInputSchema = z.object({
  headline: z.string().trim().min(3, 'Add a headline.').max(120),
  snippet: z.string().trim().min(10, 'Add a short email snippet.').max(400),
  summary: z.string().trim().min(10, 'Add the investment case.').max(4000),
  highlights: z.array(z.string().trim().min(1).max(140)).max(8),
  photos: z.array(blobUrl).max(MAX_IMAGES),
  renders: z.array(blobUrl).max(MAX_IMAGES),
  floorPlanUrl: blobUrl.nullable().optional(),
  // Pounds in, pence stored (money is always integer pence).
  sellerPrice: z.number().positive('Enter the price agreed with the seller.'),
  fee: z.number().nonnegative('Fee cannot be negative.'),
  marketValue: optionalPounds,
  refurbEstimate: optionalPounds,
  gdv: optionalPounds,
  monthlyRent: optionalPounds,
  tenure: z.string().trim().max(60).nullable().optional(),
  epcRating: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-G]$/, 'EPC rating is a single letter, A to G.')
    .nullable()
    .optional(),
  floorAreaSqft: z.number().int().positive().nullable().optional(),
});

export type PackInput = z.input<typeof packInputSchema>;

function revalidatePack(dealId: string) {
  revalidatePath(`/deals/${dealId}`);
  revalidatePath('/investors');
}

/** Create or update the draft pack. A live pack can still be corrected. */
export async function saveInvestorPack(dealId: string, input: PackInput) {
  const { userId } = await requireFounder();

  const parsed = packInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Check the pack.');
  }
  const p = parsed.data;

  const deal = await database.deal.findUnique({
    where: { id: dealId },
    select: { id: true, investorPack: { select: { status: true } } },
  });
  if (!deal) throw new Error('Deal not found');
  if (deal.investorPack?.status === 'withdrawn') {
    throw new Error('This pack was withdrawn. Reopen it first.');
  }

  const sellerPricePence = poundsToPence(p.sellerPrice);
  const feePence = poundsToPence(p.fee);

  const data = {
    headline: p.headline,
    snippet: p.snippet,
    summary: p.summary,
    highlights: p.highlights.filter(Boolean),
    photos: p.photos,
    renders: p.renders,
    floorPlanUrl: p.floorPlanUrl ?? null,
    sellerPricePence,
    feePence,
    // The floor, and in Phase 1 the only price: what we agreed with the
    // seller plus our fee. Computed here so it can never drift from its parts.
    pricePence: sellerPricePence + feePence,
    marketValuePence: p.marketValue,
    refurbEstimatePence: p.refurbEstimate,
    gdvPence: p.gdv,
    monthlyRentPence: p.monthlyRent,
    tenure: p.tenure || null,
    epcRating: p.epcRating || null,
    floorAreaSqft: p.floorAreaSqft ?? null,
  };

  await database.investorPack.upsert({
    where: { dealId },
    create: { dealId, createdBy: userId, ...data },
    update: data,
  });

  revalidatePack(dealId);
  return { ok: true };
}

/**
 * Upload one photo, render or floor plan to blob storage. Returns the public
 * URL; the editor adds it to the pack and the next save persists it.
 */
export async function uploadPackImage(dealId: string, formData: FormData) {
  await requireFounder();

  const file = formData.get('file');
  if (!file || !(file instanceof Blob)) throw new Error('No file provided.');
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) {
    throw new Error('Use JPEG, PNG or WebP images.');
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Images must be under 10MB.');
  }

  const ext = file.type.split('/')[1] ?? 'jpg';
  const blob = await put(
    `investor-packs/${dealId}/${Date.now()}.${ext}`,
    file,
    { access: 'public', contentType: file.type }
  );
  return { url: blob.url };
}

const draftSchema = z.object({
  headline: z.string(),
  snippet: z.string(),
  summary: z.string(),
  highlights: z.array(z.string()),
});

/**
 * First draft of the pack's words from what we already know about the deal.
 * The founder edits before anything is sent. Returns null-safe errors so the
 * editor can say "write it yourself" rather than crash.
 */
export type DraftFigures = {
  /** All money in pounds, as typed in the editor (may be unsaved). */
  price: number | null;
  marketValue: number | null;
  refurbEstimate: number | null;
  gdv: number | null;
  monthlyRent: number | null;
  tenure: string | null;
  epcRating: string | null;
  floorAreaSqft: number | null;
};

export async function draftInvestorPackCopy(
  dealId: string,
  figures: DraftFigures
) {
  await requireFounder();

  const deal = await database.deal.findUnique({
    where: { id: dealId },
    select: {
      postcode: true,
      propertyType: true,
      bedrooms: true,
      estimatedMarketValuePence: true,
      viewings: {
        where: { status: { in: ['submitted', 'reviewed'] } },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { summary: true, redFlags: true, refurbEstimatePence: true },
      },
    },
  });
  if (!deal) throw new Error('Deal not found');

  const f = figures;
  const viewing = deal.viewings[0];
  const pounds = (p: number | null | undefined) =>
    p ? `£${Math.round(p).toLocaleString('en-GB')}` : 'unknown';
  const fromPence = (p: number | null | undefined) => (p ? p / 100 : null);

  const facts = [
    `Property: ${deal.bedrooms ?? '?'} bed ${deal.propertyType}, postcode district ${deal.postcode.split(' ')[0]}`,
    `Price to investor: ${pounds(f.price)}`,
    `Market value (our view): ${pounds(f.marketValue ?? fromPence(deal.estimatedMarketValuePence))}`,
    `Refurb estimate: ${pounds(f.refurbEstimate ?? fromPence(viewing?.refurbEstimatePence))}`,
    `Value after works: ${pounds(f.gdv)}`,
    `Achievable rent per month: ${pounds(f.monthlyRent)}`,
    `Tenure: ${f.tenure ?? 'unknown'}; EPC: ${f.epcRating ?? 'unknown'}; floor area: ${f.floorAreaSqft ? `${f.floorAreaSqft} sq ft` : 'unknown'}`,
    viewing?.summary ? `Viewing notes: ${viewing.summary}` : null,
    viewing?.redFlags ? `Known issues: ${viewing.redFlags}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const result = await callClaudeForObject({
    feature: 'investor-pack-draft',
    model: CLAUDE_SONNET,
    schema: draftSchema,
    maxTokens: 900,
    temperature: 0.4,
    system: [
      'You write investment packs for Kept, a UK property company, offering an off-market deal to experienced cash investors.',
      'Voice: calm, precise, factual. Short declarative sentences. No hype, no exclamation marks, no urgency language, no em dashes.',
      'Never invent a fact. Use only the figures given. If a figure is unknown, leave it out rather than guess.',
      'State known issues plainly; investors trust a pack that names the catch.',
      'Never mention the seller, their circumstances, or why they are selling.',
      'Return: headline (max 70 chars, e.g. "Three-bed terrace in NG7, below market value"),',
      'snippet (1-2 sentences for the email, max 250 chars),',
      'summary (2-3 short paragraphs: the property, the numbers, the opportunity and the risks),',
      'highlights (3-6 short factual bullets, max 80 chars each).',
    ].join('\n'),
    user: facts,
  });

  if (!result) {
    throw new Error('The AI draft failed. Write it yourself or try again.');
  }
  // House rule: no em dashes in copy, whatever the model does.
  const clean = (t: string) => t.replace(/\s*—\s*/g, ', ').trim();
  return {
    headline: clean(result.headline),
    snippet: clean(result.snippet),
    summary: clean(result.summary),
    highlights: result.highlights.map(clean).filter(Boolean),
  };
}

/**
 * Publish the pack and email it to every active investor link that has an
 * email address. Each investor gets their own token in the link, so interest
 * they register from the pack is attributed to them. Founder click only.
 */
export async function sendInvestorPack(dealId: string) {
  const { userId } = await requireFounder();

  const pack = await database.investorPack.findUnique({
    where: { dealId },
    include: {
      deal: {
        select: { postcode: true, propertyType: true, bedrooms: true },
      },
    },
  });
  if (!pack) throw new Error('Build and save the pack first.');
  if (pack.status === 'withdrawn' || pack.status === 'closed') {
    throw new Error('This pack is no longer open. Reopen it to send again.');
  }
  if (pack.photos.length === 0) {
    throw new Error('Add at least one photo before sending.');
  }

  const recipients = await database.investorAccessToken.findMany({
    where: { revoked: false, email: { not: null } },
    select: { token: true, label: true, email: true },
  });
  if (recipients.length === 0) {
    throw new Error(
      'No investors to send to. Add investor links with an email on the Investors page.'
    );
  }

  // First send opens the two-week window; a re-send (e.g. to a newly added
  // investor) keeps the original close date.
  const now = new Date();
  const publishedAt = pack.publishedAt ?? now;
  const closesAt =
    pack.closesAt ??
    new Date(now.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000);

  await database.investorPack.update({
    where: { dealId },
    data: { status: 'live', publishedAt, closesAt },
  });

  const webUrl = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3001';
  const district = pack.deal.postcode.split(' ')[0];
  const propertyLine = [
    pack.deal.bedrooms ? `${pack.deal.bedrooms} bed` : null,
    pack.deal.propertyType,
    district,
  ]
    .filter(Boolean)
    .join(' · ');

  let sent = 0;
  const failed: string[] = [];
  for (const r of recipients) {
    if (!r.email) continue;
    const email = renderPackEmail({
      investorLabel: r.label,
      headline: pack.headline,
      snippet: pack.snippet,
      propertyLine,
      pricePence: pack.pricePence,
      marketValuePence: pack.marketValuePence,
      heroPhotoUrl: pack.photos[0] ?? null,
      closesAt,
      packUrl: `${webUrl}/investors/${r.token}/deals/${dealId}`,
    });
    try {
      const res = await sendEmail({ to: r.email, ...email });
      if (!res.skipped) sent += 1;
      else failed.push(r.email);
    } catch {
      failed.push(r.email);
    }
  }

  await database.investorPack.update({
    where: { dealId },
    data: { sentCount: { increment: sent } },
  });

  await database.dealActivity.create({
    data: {
      dealId,
      action: 'investor_pack_sent',
      detail: `Investor pack sent to ${sent} of ${recipients.length} investor(s). Interest closes ${closesAt.toDateString()}.${failed.length ? ` Not delivered: ${failed.join(', ')}.` : ''}`,
      userId,
    },
  });

  revalidatePack(dealId);
  return { sent, total: recipients.length, failed, closesAt };
}

/** Pull a pack: the page shows "no longer available" and interest stops. */
export async function setInvestorPackStatus(
  dealId: string,
  status: 'draft' | 'closed' | 'withdrawn'
) {
  const { userId } = await requireFounder();

  const pack = await database.investorPack.findUnique({
    where: { dealId },
    select: { status: true },
  });
  if (!pack) throw new Error('No pack for this deal.');

  await database.investorPack.update({
    where: { dealId },
    // Reopening to draft clears the window so the next send starts a fresh
    // two weeks.
    data:
      status === 'draft'
        ? { status, publishedAt: null, closesAt: null }
        : { status },
  });

  await database.dealActivity.create({
    data: {
      dealId,
      action: `investor_pack_${status}`,
      detail: `Investor pack ${pack.status} → ${status}.`,
      userId,
    },
  });

  revalidatePack(dealId);
  return { ok: true };
}

/**
 * A preview link for the founder. Uses a dedicated access token with no
 * email, so it never receives sends and its interest clicks are obvious.
 */
export async function getPackPreviewUrl(dealId: string) {
  const { userId } = await requireFounder();

  const label = 'Founder preview';
  let token = await database.investorAccessToken.findFirst({
    where: { label, email: null, revoked: false },
    select: { token: true },
  });
  if (!token) {
    const bytes = new Uint8Array(18);
    crypto.getRandomValues(bytes);
    token = await database.investorAccessToken.create({
      data: {
        token: Buffer.from(bytes)
          .toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, ''),
        label,
        createdBy: userId,
      },
      select: { token: true },
    });
  }

  const webUrl = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3001';
  return { url: `${webUrl}/investors/${token.token}/deals/${dealId}` };
}
