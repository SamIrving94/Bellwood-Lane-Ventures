import { auth } from '@repo/auth/server';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Header } from '../components/header';

export const metadata: Metadata = {
  title: 'Valuations — Bellwood Ventures',
  description: 'AVM runner and valuation history',
};

const ValuationsPage = async () => {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  return (
    <>
      <Header pages={[]} page="Valuations" />
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-2 text-lg font-semibold">Quick Valuation</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Enter a postcode and property type to run an Automated Valuation Model (AVM).
          </p>
          <form className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor="postcode" className="mb-1 block text-sm font-medium">
                Postcode
              </label>
              <input
                id="postcode"
                name="postcode"
                type="text"
                placeholder="e.g. SE18 7AB"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="propertyType" className="mb-1 block text-sm font-medium">
                Property Type
              </label>
              <select
                id="propertyType"
                name="propertyType"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="semi-detached">Semi-detached</option>
                <option value="terraced">Terraced</option>
                <option value="detached">Detached</option>
                <option value="flat">Flat</option>
                <option value="bungalow">Bungalow</option>
              </select>
            </div>
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Run AVM
            </button>
          </form>
        </div>

        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-muted-foreground">
            AVM engine coming soon. This will pull Land Registry comps, EPC data, flood risk,
            and calculate risk-adjusted offers automatically.
          </p>
        </div>
      </div>
    </>
  );
};

export default ValuationsPage;
