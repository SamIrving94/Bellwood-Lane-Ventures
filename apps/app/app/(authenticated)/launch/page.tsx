import { auth } from '@repo/auth/server';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Header } from '../components/header';
import { getLaunchState } from './actions';
import { LaunchChecklist } from './checklist-view';

export const metadata: Metadata = {
  title: 'Launch — Kept',
  description: 'The October launch board: one next step per person.',
};

export const dynamic = 'force-dynamic';

/**
 * /launch — the October launch board. One shared tickable list (state in
 * the Setting table), task definitions shipped in code
 * (lib/launch-checklist.ts). Built ADHD-first: each person sees ONE
 * "do this now" card with literal steps; everything else stays quiet.
 */
const LaunchPage = async () => {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const state = await getLaunchState();

  return (
    <>
      <Header page="Launch" pages={[]} />
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div>
          <h1 className="font-bold text-xl">October launch board</h1>
          <p className="text-muted-foreground text-sm">
            One next step each. Do the green card, press Done, the next one
            appears. Both of you see the same live board.
          </p>
        </div>
        <LaunchChecklist initialState={state} />
      </div>
    </>
  );
};

export default LaunchPage;
