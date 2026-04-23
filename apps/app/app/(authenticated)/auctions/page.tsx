import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Header } from '../components/header';
import { AuctionsTable } from './auctions-table';

export const metadata: Metadata = {
  title: 'Auctions — Bellwood Ventures',
  description: 'Upcoming UK auction lots scraped from free public sources',
};

const AuctionsPage = async () => {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  // Show lots auctioning today or in the future
  const now = new Date();
  const lots = await database.auctionLot.findMany({
    where: { auctionDate: { gte: now } },
    orderBy: [{ auctionDate: 'asc' }, { guidePriceMinPence: 'asc' }],
    take: 300,
  });

  return (
    <>
      <Header pages={[]} page="Auctions" />
      <div className="flex flex-1 flex-col gap-4 p-6">
        <AuctionsTable
          lots={lots.map((l) => ({
            id: l.id,
            sourceHouse: l.sourceHouse,
            sourceLotRef: l.sourceLotRef,
            auctionDate: l.auctionDate.toISOString(),
            address: l.address,
            postcode: l.postcode,
            propertyType: l.propertyType,
            guidePriceMinPence: l.guidePriceMinPence,
            guidePriceMaxPence: l.guidePriceMaxPence,
            lotUrl: l.lotUrl,
          }))}
        />
      </div>
    </>
  );
};

export default AuctionsPage;
