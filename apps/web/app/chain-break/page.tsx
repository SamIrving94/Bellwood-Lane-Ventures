import { SituationLanding } from '@/components/situation-landing';
import type { Metadata } from 'next';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Your buyer pulled out. The chain doesn’t have to break · Kept',
  description:
    'When a buyer pulls out weeks from the finish, we step in: cash, no chain behind us, an offer in writing within two working days of viewing, and completion in as little as two weeks.',
};

export default function ChainBreakPage() {
  return <SituationLanding situationKey="chain-break" />;
}
