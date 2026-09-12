import { SituationLanding } from '@/components/situation-landing';
import type { Metadata } from 'next';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'A property with a problem, or one that needs work · Kept',
  description:
    'Structural issues, knotweed, a short lease, a lender that says no, or a house that needs a full refurbishment. We view it, confirm a price in writing, and buy it as it is.',
};

export default function ProblemPropertyPage() {
  return <SituationLanding situationKey="problem-property" />;
}
