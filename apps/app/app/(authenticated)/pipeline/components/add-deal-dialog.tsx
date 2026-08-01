'use client';

import { createDeal } from '@/app/actions/deals/create';
import { useState, useTransition } from 'react';

export const AddDealDialog = () => {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    startTransition(async () => {
      await createDeal({
        address: fd.get('address') as string,
        postcode: fd.get('postcode') as string,
        propertyType: fd.get('propertyType') as string,
        bedrooms: fd.get('bedrooms') ? Number(fd.get('bedrooms')) : undefined,
        sellerType: fd.get('sellerType') as any,
        askingPricePence: fd.get('askingPrice')
          ? Math.round(Number(fd.get('askingPrice')) * 100)
          : undefined,
        sellerName: (fd.get('sellerName') as string) || undefined,
        sellerEmail: (fd.get('sellerEmail') as string) || undefined,
        sellerPhone: (fd.get('sellerPhone') as string) || undefined,
        notes: (fd.get('notes') as string) || undefined,
      });
      setOpen(false);
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        + Add Deal
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-lg rounded-xl border bg-background p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add New Deal</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-muted-foreground hover:text-foreground"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Address + Postcode */}
          <div>
            <label htmlFor="address" className="mb-1 block text-sm font-medium">
              Address *
            </label>
            <input
              id="address"
              name="address"
              required
              placeholder="42 Oak Lane, London"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="postcode" className="mb-1 block text-sm font-medium">
                Postcode *
              </label>
              <input
                id="postcode"
                name="postcode"
                required
                placeholder="SE18 7AB"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm uppercase"
              />
            </div>
            <div>
              <label htmlFor="propertyType" className="mb-1 block text-sm font-medium">
                Property Type *
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
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="bedrooms" className="mb-1 block text-sm font-medium">
                Bedrooms
              </label>
              <input
                id="bedrooms"
                name="bedrooms"
                type="number"
                min="0"
                max="10"
                placeholder="3"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="sellerType" className="mb-1 block text-sm font-medium">
                Seller Type
              </label>
              <select
                id="sellerType"
                name="sellerType"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="standard">Standard</option>
                <option value="probate">Probate</option>
                <option value="chain_break">Chain Break</option>
                <option value="repossession">Repossession</option>
                <option value="short_lease">Short Lease</option>
                <option value="relocation">Relocation</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="askingPrice" className="mb-1 block text-sm font-medium">
              Asking Price
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-sm text-muted-foreground">
                &pound;
              </span>
              <input
                id="askingPrice"
                name="askingPrice"
                type="number"
                min="0"
                step="1000"
                placeholder="250000"
                className="w-full rounded-md border bg-background py-2 pl-7 pr-3 text-sm"
              />
            </div>
          </div>

          {/* Seller contact */}
          <div className="border-t pt-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Seller Contact (optional)
            </p>
            <div className="space-y-3">
              <input
                name="sellerName"
                placeholder="Name"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  name="sellerEmail"
                  type="email"
                  placeholder="Email"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
                <input
                  name="sellerPhone"
                  type="tel"
                  placeholder="Phone"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="notes" className="mb-1 block text-sm font-medium">
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={2}
              placeholder="Any context about this deal..."
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending ? 'Creating...' : 'Create Deal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
