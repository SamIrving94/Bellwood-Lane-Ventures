'use client';

import { Button } from '@repo/design-system/components/ui/button';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  mintInvestorToken,
  restoreInvestorToken,
  revokeInvestorToken,
} from '@/app/actions/investors/access-tokens';

type Token = {
  id: string;
  token: string;
  label: string;
  email: string | null;
  revoked: boolean;
  lastViewedAt: Date | null;
  viewCount: number;
};

export function InvestorAccessLinks({
  webUrl,
  tokens,
}: {
  webUrl: string;
  tokens: Token[];
}) {
  const [isPending, startTransition] = useTransition();
  const [label, setLabel] = useState('');
  const [email, setEmail] = useState('');

  const linkFor = (token: string) => `${webUrl}/investors/${token}`;

  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(linkFor(token));
      toast.success('Link copied.');
    } catch {
      toast.error('Could not copy — select the link manually.');
    }
  };

  const handleMint = () => {
    if (!label.trim()) {
      toast.error('Add a name for this link.');
      return;
    }
    startTransition(async () => {
      try {
        const { token } = await mintInvestorToken(label, email || undefined);
        setLabel('');
        setEmail('');
        await navigator.clipboard.writeText(linkFor(token)).catch(() => {});
        toast.success('Link created and copied to clipboard.');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to create.');
      }
    });
  };

  const handleRevoke = (id: string, revoked: boolean) => {
    startTransition(async () => {
      try {
        if (revoked) {
          await restoreInvestorToken(id);
          toast.success('Link restored.');
        } else {
          await revokeInvestorToken(id);
          toast.success('Link revoked.');
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed.');
      }
    });
  };

  return (
    <div className="rounded-xl border bg-card p-4">
      <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        Investor access links
      </h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Give an investor a read-only link to the public feed. No login — the
        link alone grants access, and you can revoke it any time.
      </p>

      {tokens.length > 0 && (
        <ul className="mt-3 divide-y rounded-md border">
          {tokens.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {t.label}
                  {t.revoked && (
                    <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-800 dark:bg-red-950 dark:text-red-300">
                      revoked
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {t.email ? `${t.email} · ` : ''}
                  {t.viewCount} view{t.viewCount === 1 ? '' : 's'}
                  {t.lastViewedAt
                    ? ` · last ${new Date(t.lastViewedAt).toLocaleDateString('en-GB')}`
                    : ''}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                {!t.revoked && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copy(t.token)}
                    disabled={isPending}
                  >
                    Copy link
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRevoke(t.id, t.revoked)}
                  disabled={isPending}
                >
                  {t.revoked ? 'Restore' : 'Revoke'}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Investor / firm name"
          className="rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email (optional)"
          className="rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <Button size="sm" onClick={handleMint} disabled={isPending}>
          {isPending ? 'Creating…' : 'Create link'}
        </Button>
      </div>
    </div>
  );
}
