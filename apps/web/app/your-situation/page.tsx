import { SituationLanding } from '@/components/situation-landing';
import type { Metadata } from 'next';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Something else? Quickly, quietly, discreetly · Kept',
  description:
    'Not every reason for selling fits a heading. Tell us what is going on and we tailor the process to it: one viewing, a price in writing, completion on your date, no board and no listing.',
};

export default function YourSituationPage() {
  return <SituationLanding situationKey="your-situation" />;
}
