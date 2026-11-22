'use client';

import { Button } from '@repo/design-system/components/ui/button';
import { CheckIcon, EditIcon, MailIcon, XIcon } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { draftHoldInGmail } from '@/app/actions/google';
import { approveHold, rejectHold } from '@/app/actions/outreach/review-hold';

type Hold = {
  id: string;
  recipientName: string | null;
  recipientEmail: string | null;
  recipientType: string;
  renderedSubject: string;
  renderedBody: string;
  createdAt: Date;
};

export function HoldCard({
  hold,
  gmailConnected = false,
}: {
  hold: Hold;
  /** Kept Google account is connected: offer "To Gmail drafts". */
  gmailConnected?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editedBody, setEditedBody] = useState(hold.renderedBody);
  const [isPending, startTransition] = useTransition();

  const handleApprove = () => {
    startTransition(async () => {
      const body = editing && editedBody !== hold.renderedBody ? editedBody : undefined;
      await approveHold(hold.id, body);
    });
  };

  // Nothing is sent: the email lands in Gmail Drafts for the founder to
  // finish and send from their own address.
  const handleDraft = () => {
    startTransition(async () => {
      const body = editing && editedBody !== hold.renderedBody ? editedBody : undefined;
      const result = await draftHoldInGmail(hold.id, body);
      if (result.ok) {
        toast.success(`In your Gmail drafts (${result.mailbox}). Not sent yet.`);
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleReject = () => {
    startTransition(async () => {
      await rejectHold(hold.id);
    });
  };

  return (
    <div className={`rounded-lg border bg-card p-4 transition-opacity ${isPending ? 'opacity-50' : ''}`}>
      {/* Recipient info */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-medium">{hold.recipientName ?? 'Unknown Vendor'}</p>
          <p className="text-xs text-muted-foreground">
            {hold.recipientEmail} &middot; {hold.recipientType}
          </p>
        </div>
        <span className="text-xs text-muted-foreground">
          {new Date(hold.createdAt).toLocaleDateString('en-GB')}
        </span>
      </div>

      {/* Subject */}
      <div className="mb-3 rounded bg-muted px-3 py-2">
        <p className="text-xs text-muted-foreground">Subject</p>
        <p className="text-sm font-medium">{hold.renderedSubject}</p>
      </div>

      {/* Body - view or edit */}
      {editing ? (
        <textarea
          className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none"
          rows={8}
          value={editedBody}
          onChange={(e) => setEditedBody(e.target.value)}
        />
      ) : (
        <div className="rounded bg-muted px-3 py-2 mb-3">
          <p className="text-xs text-muted-foreground mb-1">Body</p>
          <p className="text-sm whitespace-pre-wrap">{hold.renderedBody}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 mt-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEditing(!editing)}
          disabled={isPending}
        >
          <EditIcon className="mr-1 h-3 w-3" />
          {editing ? 'Preview' : 'Edit'}
        </Button>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReject}
          disabled={isPending}
        >
          <XIcon className="mr-1 h-3 w-3" />
          Reject
        </Button>
        {gmailConnected && hold.recipientEmail && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDraft}
            disabled={isPending}
          >
            <MailIcon className="mr-1 h-3 w-3" />
            To Gmail drafts
          </Button>
        )}
        <Button
          size="sm"
          onClick={handleApprove}
          disabled={isPending}
        >
          <CheckIcon className="mr-1 h-3 w-3" />
          {editing && editedBody !== hold.renderedBody ? 'Approve (edited)' : 'Approve & Send'}
        </Button>
      </div>
    </div>
  );
}
