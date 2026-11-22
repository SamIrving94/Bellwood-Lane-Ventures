'use client';

import { sendInboxReply } from '@/app/actions/inbox/reply';
import { Button } from '@repo/design-system/components/ui/button';
import { SendIcon } from 'lucide-react';
import { useState, useTransition } from 'react';

export function ReplyForm({ address }: { address: string }) {
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSend = () => {
    setError(null);
    setSent(false);
    startTransition(async () => {
      const result = await sendInboxReply(address, body);
      if (result.ok) {
        setBody('');
        setSent(true);
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <label className="block font-medium text-sm" htmlFor="inbox-reply">
        Reply to {address}
      </label>
      <textarea
        className="min-h-40 w-full rounded-md border bg-background p-3 text-sm"
        disabled={isPending}
        id="inbox-reply"
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write your reply. It is sent exactly as you type it."
        value={body}
      />
      <div className="flex items-center gap-3">
        <Button disabled={isPending || !body.trim()} onClick={handleSend}>
          <SendIcon className="mr-2 h-4 w-4" />
          {isPending ? 'Sending…' : 'Send reply'}
        </Button>
        {sent && <p className="text-muted-foreground text-sm">Sent.</p>}
        {error && (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
