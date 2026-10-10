// Investor pack: one back-to-back deal, shown to one investor through their
// own access link. Token-gated, noindex, never cached. Kept's own economics
// (the seller price and our fee) and all seller details are NEVER selected
// here: the investor sees the price, the property and our estimates.

import { isPreviewToken, packState } from '@/lib/investor-pack';
import { database } from '@repo/database';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PackView } from './pack-view';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Investment pack · Kept',
  robots: { index: false, follow: false },
};

const pounds = (pence: number | null) => (pence === null ? null : pence / 100);

export default async function InvestorPackPage({
  params,
}: {
  params: Promise<{ token: string; dealId: string }>;
}) {
  const { token, dealId } = await params;

  const access = await database.investorAccessToken.findUnique({
    where: { token },
    select: { id: true, label: true, email: true, revoked: true },
  });
  if (!access || access.revoked) notFound();
  const preview = isPreviewToken(access);

  const pack = await database.investorPack.findUnique({
    where: { dealId },
    select: {
      id: true,
      status: true,
      headline: true,
      summary: true,
      highlights: true,
      photos: true,
      renders: true,
      floorPlanUrl: true,
      pricePence: true,
      marketValuePence: true,
      refurbEstimatePence: true,
      gdvPence: true,
      monthlyRentPence: true,
      tenure: true,
      epcRating: true,
      floorAreaSqft: true,
      closesAt: true,
      deal: {
        select: { postcode: true, propertyType: true, bedrooms: true },
      },
    },
  });
  if (!pack) notFound();

  const state = packState(pack);
  // Drafts exist only for the founder's preview link.
  if (state === 'preview' && !preview) notFound();

  if (!preview) {
    // Best-effort view tracking: never block the render on it.
    await Promise.all([
      database.investorPack
        .update({
          where: { id: pack.id },
          data: { viewCount: { increment: 1 } },
        })
        .catch(() => {}),
      database.investorAccessToken
        .update({
          where: { id: access.id },
          data: { viewCount: { increment: 1 }, lastViewedAt: new Date() },
        })
        .catch(() => {}),
    ]);
  }

  const existing = access.email
    ? await database.investorInterest.findUnique({
        where: {
          dealId_investorEmail: {
            dealId,
            investorEmail: access.email.toLowerCase(),
          },
        },
        select: { createdAt: true },
      })
    : null;

  const district = pack.deal.postcode.split(' ')[0];
  const facts = [
    pack.deal.bedrooms ? ['Bedrooms', String(pack.deal.bedrooms)] : null,
    ['Type', pack.deal.propertyType],
    ['Location', district],
    pack.tenure ? ['Tenure', pack.tenure] : null,
    pack.epcRating ? ['EPC', pack.epcRating] : null,
    pack.floorAreaSqft
      ? ['Floor area', `${pack.floorAreaSqft.toLocaleString('en-GB')} sq ft`]
      : null,
  ].filter((f): f is [string, string] => f !== null);

  return (
    <PackView
      token={token}
      dealId={dealId}
      label={access.label}
      preview={preview}
      hasEmail={Boolean(access.email)}
      registeredAt={existing ? existing.createdAt.toISOString() : null}
      state={state}
      pack={{
        status: pack.status,
        headline: pack.headline,
        summary: pack.summary,
        highlights: pack.highlights,
        photos: pack.photos,
        renders: pack.renders,
        floorPlanUrl: pack.floorPlanUrl,
        price: pack.pricePence / 100,
        marketValue: pounds(pack.marketValuePence),
        refurbEstimate: pounds(pack.refurbEstimatePence),
        valueAfterWorks: pounds(pack.gdvPence),
        monthlyRent: pounds(pack.monthlyRentPence),
        closesAt: pack.closesAt,
        facts,
        district,
        propertyType: pack.deal.propertyType,
      }}
    />
  );
}
