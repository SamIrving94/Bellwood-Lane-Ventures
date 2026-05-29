'use client';

import { Button } from '@repo/design-system/components/ui/button';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  postInvestorUpdate,
  registerInvestorInterest,
  removeInvestorInterest,
} from '@/app/actions/deals/investor-interest';

type Interest = {
  id: string;
  investorName: string;
  investorEmail: string;
  note: string | null;
  notify: boolean;
  createdAt: Date;
};

export function InvestorPanel({
  dealId,
  interests,
}: {
  dealId: string;
  interests: Interest[];
}) {
  const [isPending, startTransition] = useTransition();

  // Add-interest form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');

  // Post-update form
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');

  const handleAdd = () => {
    startTransition(async () => {
      try {
        await registerInvestorInterest(dealId, name, email, note);
        toast.success(`Logged interest from ${name.trim()}.`);
        setName('');
        setEmail('');
        setNote('');
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to log interest.',
        );
      }
    });
  };

  const handleRemove = (id: string) => {
    startTransition(async () => {
      try {
        await removeInvestorInterest(id);
        toast.success('Removed.');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to remove.');
      }
    });
  };

  const handlePost = () => {
    startTransition(async () => {
      try {
        const { notified } = await postInvestorUpdate(dealId, title, detail);
        toast.success(`Update sent to ${notified} investor(s).`);
        setTitle('');
        setDetail('');
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to send update.',
        );
      }
    });
  };

  const subscriberCount = interests.filter((i) => i.notify).length;

  return (
    <div className="rounded-lg border bg-card p-4">
      <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-muted-foreground">
        Investor interest
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">
        {interests.length} interested · {subscriberCount} subscribed to updates.
      </p>

      {/* Interest list */}
      {interests.length > 0 && (
        <ul className="mb-4 divide-y rounded-md border">
          {interests.map((i) => (
            <li
              key={i.id}
              className="flex items-start justify-between gap-3 px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium">{i.investorName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {i.investorEmail}
                  {i.notify ? ' · gets updates' : ' · muted'}
                </p>
                {i.note && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {i.note}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemove(i.id)}
                disabled={isPending}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      {/* Add interest */}
      <div className="space-y-2 rounded-md border border-dashed p-3">
        <p className="text-xs font-medium">Log an investor&apos;s interest</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Investor name"
            className="rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Investor email"
            className="rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          className="w-full rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={handleAdd} disabled={isPending}>
            Add interest
          </Button>
        </div>
      </div>

      {/* Post update to investors */}
      <div className="mt-3 space-y-2 rounded-md border border-dashed p-3">
        <p className="text-xs font-medium">Post an update to subscribers</p>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Headline (e.g. 'Survey booked for next week')"
          className="w-full rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <textarea
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder="Detail (optional)"
          rows={2}
          className="w-full rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Emails {subscriberCount} subscriber(s). Seller is not notified.
          </span>
          <Button
            size="sm"
            onClick={handlePost}
            disabled={isPending || subscriberCount === 0}
          >
            Send update
          </Button>
        </div>
      </div>
    </div>
  );
}
