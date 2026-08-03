'use client';

import { createFieldPartner } from '@/app/actions/network/field-partners';
import { Button } from '@repo/design-system/components/ui/button';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

export function PartnerForm() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [background, setBackground] = useState('');
  const [areas, setAreas] = useState('');
  const [notes, setNotes] = useState('');

  const handleSave = () => {
    startTransition(async () => {
      try {
        await createFieldPartner({
          name,
          email,
          phone: phone || null,
          background: background || null,
          postcodeAreas: areas
            .split(',')
            .map((a) => a.trim())
            .filter(Boolean),
          notes: notes || null,
        });
        toast.success('Partner added.');
        setOpen(false);
        setName('');
        setEmail('');
        setPhone('');
        setBackground('');
        setAreas('');
        setNotes('');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to add.');
      }
    });
  };

  if (!open) {
    return (
      <div>
        <Button size="sm" onClick={() => setOpen(true)}>
          Add field partner
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <h2 className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
        New field partner
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-muted-foreground text-xs">Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Dave Higgins"
            className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <label className="block">
          <span className="text-muted-foreground text-xs">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="dave@example.com"
            className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <label className="block">
          <span className="text-muted-foreground text-xs">Phone</span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="07…"
            className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <label className="block">
          <span className="text-muted-foreground text-xs">Background</span>
          <input
            type="text"
            value={background}
            onChange={(e) => setBackground(e.target.value)}
            placeholder="Retired builder, 30 yrs"
            className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-muted-foreground text-xs">
            Postcode areas (comma-separated outward codes)
          </span>
          <input
            type="text"
            value={areas}
            onChange={(e) => setAreas(e.target.value)}
            placeholder="SE15, SE22, BR1"
            className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-muted-foreground text-xs">Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Great with vendors. No ladders since the hip op."
            className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isPending || !name.trim() || !email.trim()}
        >
          {isPending ? 'Adding…' : 'Add partner'}
        </Button>
      </div>
    </div>
  );
}
