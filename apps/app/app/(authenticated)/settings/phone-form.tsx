'use client';

import { Alert, AlertDescription } from '@repo/design-system/components/ui/alert';
import { Button } from '@repo/design-system/components/ui/button';
import { Input } from '@repo/design-system/components/ui/input';
import { Label } from '@repo/design-system/components/ui/label';
import {
  CheckCircle2Icon,
  ExternalLinkIcon,
  MessageSquareIcon,
} from 'lucide-react';
import { useState, useTransition } from 'react';
import { linkPhone } from '../../actions/phone/link';

type PhoneFormProps = {
  currentPhone: string | null;
  twilioNumber?: string | null;
  sandboxKeyword?: string | null;
};

const SetupGuide = ({
  twilioNumber,
  sandboxKeyword,
  isLinked,
}: {
  twilioNumber?: string | null;
  sandboxKeyword?: string | null;
  isLinked: boolean;
}) => {
  // Strip whatsapp: prefix for display and links
  const cleanNumber = (twilioNumber ?? '+14155238886').replace('whatsapp:', '');
  // Build wa.me link — strip + and spaces
  const waNumber = cleanNumber.replace(/[^0-9]/g, '');
  const joinMessage = sandboxKeyword
    ? `join ${sandboxKeyword}`
    : undefined;
  const waLink = joinMessage
    ? `https://wa.me/${waNumber}?text=${encodeURIComponent(joinMessage)}`
    : `https://wa.me/${waNumber}`;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-dashed bg-muted/30 p-4">
      <div className="flex items-center gap-2">
        <MessageSquareIcon className="h-4 w-4 text-green-600" />
        <h4 className="text-sm font-medium">
          {isLinked ? 'Connect WhatsApp' : 'After saving your number'}
        </h4>
      </div>

      {joinMessage ? (
        <>
          <p className="text-sm text-muted-foreground">
            Tap the button below to open WhatsApp with the join message pre-filled. Send it to activate your connection.
          </p>
          <Button asChild variant="default" size="sm" className="w-fit">
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageSquareIcon className="mr-1.5 h-4 w-4" />
              Open WhatsApp &amp; join sandbox
              <ExternalLinkIcon className="ml-1.5 h-3 w-3" />
            </a>
          </Button>
          <p className="text-xs text-muted-foreground">
            This sends <code className="rounded bg-muted px-1 py-0.5">{joinMessage}</code> to <strong>{cleanNumber}</strong>.
            After you get a confirmation reply, send any message to start journaling.
          </p>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Open WhatsApp and message <strong>{cleanNumber}</strong> to start journaling.
            Send any text or voice note — it becomes a journal entry.
          </p>
          <Button asChild variant="outline" size="sm" className="w-fit">
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageSquareIcon className="mr-1.5 h-4 w-4" />
              Open WhatsApp
              <ExternalLinkIcon className="ml-1.5 h-3 w-3" />
            </a>
          </Button>
        </>
      )}

      <div className="border-t pt-3">
        <p className="text-xs font-medium text-muted-foreground">Commands you can use:</p>
        <ul className="mt-1.5 flex flex-col gap-1 text-xs text-muted-foreground">
          <li><code className="rounded bg-muted px-1 py-0.5">/streak</code> — see your journaling streak</li>
          <li><code className="rounded bg-muted px-1 py-0.5">/summary</code> — AI summary of your week</li>
          <li><code className="rounded bg-muted px-1 py-0.5">/export</code> — export recent entries</li>
          <li><code className="rounded bg-muted px-1 py-0.5">/help</code> — see all commands</li>
        </ul>
      </div>
    </div>
  );
};

export const PhoneForm = ({
  currentPhone,
  twilioNumber,
  sandboxKeyword,
}: PhoneFormProps) => {
  const [phone, setPhone] = useState(currentPhone ?? '');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      const result = await linkPhone(phone);
      if ('error' in result) {
        setError('Failed to save phone number. Please try again.');
      } else {
        setSuccess(true);
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {currentPhone && (
        <Alert>
          <CheckCircle2Icon className="h-4 w-4" />
          <AlertDescription>
            Your WhatsApp number <strong>{currentPhone}</strong> is linked.
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="phone">WhatsApp phone number</Label>
          <p className="text-sm text-muted-foreground">
            Include your country code, e.g. +44 7700 900000
          </p>
          <div className="flex gap-2">
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+44 7700 900000"
              className="max-w-xs"
              disabled={isPending}
            />
            <Button type="submit" disabled={isPending || !phone.trim()} size="sm">
              {isPending ? 'Saving…' : currentPhone ? 'Update' : 'Save'}
            </Button>
          </div>
        </div>
        {success && (
          <p className="text-sm text-green-600 dark:text-green-400">
            Phone number saved!
          </p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>

      {(currentPhone || success) && (
        <SetupGuide
          twilioNumber={twilioNumber}
          sandboxKeyword={sandboxKeyword}
          isLinked={!!currentPhone}
        />
      )}
    </div>
  );
};
