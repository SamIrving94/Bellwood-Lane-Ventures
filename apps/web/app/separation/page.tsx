import { SituationLanding } from '@/components/situation-landing';
import type { Metadata } from 'next';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'A clean break, on a date you both know · Kept',
  description:
    'Selling during a separation: one viewing, a price in writing that does not change, and completion when the paperwork allows. Solicitors talk to solicitors.',
};

export default function SeparationPage() {
  return <SituationLanding situationKey="separation" />;
}
