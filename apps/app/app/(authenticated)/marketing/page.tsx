import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Marketing — Bellwoods Lane',
  description: 'Approve drafts, see publication cadence, and track KPIs.',
};

const MarketingPage = () => {
  redirect('/marketing/queue');
};

export default MarketingPage;
