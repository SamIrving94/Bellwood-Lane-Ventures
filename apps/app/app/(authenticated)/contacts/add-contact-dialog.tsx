'use client';

import { createContact } from '@/app/actions/contacts/create';
import { useState, useTransition } from 'react';

export const AddContactDialog = () => {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const tagsRaw = (fd.get('tags') as string) || '';

    startTransition(async () => {
      await createContact({
        type: fd.get('type') as string,
        name: fd.get('name') as string,
        company: (fd.get('company') as string) || undefined,
        email: (fd.get('email') as string) || undefined,
        phone: (fd.get('phone') as string) || undefined,
        location: (fd.get('location') as string) || undefined,
        notes: (fd.get('notes') as string) || undefined,
        tags: tagsRaw
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
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
        + Add Contact
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-lg rounded-xl border bg-background p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add Contact</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-muted-foreground hover:text-foreground"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="name" className="mb-1 block text-sm font-medium">
                Name *
              </label>
              <input
                id="name"
                name="name"
                required
                placeholder="John Smith"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="type" className="mb-1 block text-sm font-medium">
                Type *
              </label>
              <select
                id="type"
                name="type"
                required
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="estate_agent">Estate Agent</option>
                <option value="solicitor">Solicitor</option>
                <option value="vendor">Vendor</option>
                <option value="investor">Investor</option>
                <option value="sourcer">Sourcer</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="company" className="mb-1 block text-sm font-medium">
              Company
            </label>
            <input
              id="company"
              name="company"
              placeholder="Foxtons, Irwin Mitchell, etc."
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="john@example.com"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="phone" className="mb-1 block text-sm font-medium">
                Phone
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                placeholder="07700 900000"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label htmlFor="location" className="mb-1 block text-sm font-medium">
              Area / Location
            </label>
            <input
              id="location"
              name="location"
              placeholder="South East London, Kent, etc."
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="tags" className="mb-1 block text-sm font-medium">
              Tags (comma-separated)
            </label>
            <input
              id="tags"
              name="tags"
              placeholder="probate-specialist, london-se, high-volume"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="notes" className="mb-1 block text-sm font-medium">
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={2}
              placeholder="How you met them, key info..."
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
              {isPending ? 'Saving...' : 'Save Contact'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
