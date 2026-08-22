import { SituationLanding } from '@/components/situation-landing';
import type { Metadata } from 'next';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Sign once. Complete from anywhere · Kept',
  description:
    'Moving abroad or for work: we view the property, confirm the price in writing, and complete on the date that suits the move rather than the market.',
};

export default function RelocationPage() {
  return <SituationLanding situationKey="relocation" />;
}
