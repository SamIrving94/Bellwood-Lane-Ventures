import { SituationLanding } from '@/components/situation-landing';
import type { Metadata } from 'next';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Probate, in plain English: a guide for executors · Kept',
  description:
    'What happens after someone dies, what an executor has to do, where the property fits, and when a cash sale is (and is not) the right call.',
};

export default function ProbatePage() {
  return <SituationLanding situationKey="probate" />;
}
