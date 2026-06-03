import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/design-system/components/ui/card';
import {
  CompassIcon,
  GavelIcon,
  InboxIcon,
  MegaphoneIcon,
  SparklesIcon,
  type LucideIcon,
} from 'lucide-react';
import type { Metadata } from 'next';
import { Header } from '../components/header';
import { TourCard } from './tour-card';

export const metadata: Metadata = {
  title: 'Guide — Bellwood Ventures',
  description: 'Launch a guided tour of any section in the app.',
};

type TourEntry = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

// Mirrors TOUR_META in ./tours.ts. Kept inline so this server component
// does not pull the client-only launcher into the server bundle.
const TOURS: TourEntry[] = [
  {
    id: 'onboarding',
    title: 'Onboarding',
    description: 'A guided walk through every section in the sidebar.',
    icon: CompassIcon,
  },
  {
    id: 'today',
    title: 'Today',
    description:
      'How the action queue, SLAs and overnight leads fit together.',
    icon: InboxIcon,
  },
  {
    id: 'appraisals',
    title: 'Appraisals',
    description: 'The nine sections of a deep appraisal, explained.',
    icon: GavelIcon,
  },
  {
    id: 'marketing',
    title: 'Marketing',
    description:
      'How the draft queue, anonymisation gate and calendar work.',
    icon: MegaphoneIcon,
  },
];

const GuidePage = () => {
  return (
    <>
      <Header pages={[]} page="Guide" />
      <main className="mx-auto w-full max-w-4xl space-y-8 p-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Guided tours
          </p>
          <h1 className="mt-1 font-semibold text-2xl tracking-tight">Guide</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground text-sm">
            Pick a tour to see what a section is for. Each one overlays the
            real app, so you can follow along on a live page. You can also
            launch a tour from the Tour button in the top bar — it picks the
            one that matches the page you are on.
          </p>
        </div>

        <section>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Tours
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {TOURS.map((t) => (
              <TourCard
                key={t.id}
                tourId={t.id}
                title={t.title}
                description={t.description}
                icon={t.icon}
              />
            ))}
            <Card className="flex h-full flex-col gap-3 border-dashed bg-muted/30">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <SparklesIcon className="h-4 w-4" />
                  </span>
                  <CardTitle className="text-muted-foreground">
                    More tours, coming soon
                  </CardTitle>
                </div>
                <CardDescription>
                  Leads, Pipeline, Investors, Research, Outreach, Contacts and
                  Documents will get their own tours as each section settles.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>
      </main>
    </>
  );
};

export default GuidePage;
