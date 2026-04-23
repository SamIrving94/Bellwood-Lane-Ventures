'use client';

import { Button } from '@repo/design-system/components/ui/button';
import { Input } from '@repo/design-system/components/ui/input';
import { Label } from '@repo/design-system/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/design-system/components/ui/select';
import { Textarea } from '@repo/design-system/components/ui/textarea';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { pasteWhatsAppMessage } from '@/app/actions/intake/paste';

export function PasteForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rawText, setRawText] = useState('');
  const [source, setSource] = useState<'paste' | 'share_sheet'>('paste');
  const [groupName, setGroupName] = useState('');
  const [senderName, setSenderName] = useState('');

  const onSubmit = () => {
    if (!rawText.trim()) {
      toast.error('Paste a message first');
      return;
    }
    startTransition(async () => {
      try {
        const result = await pasteWhatsAppMessage({
          rawText,
          source,
          groupName: groupName.trim() || undefined,
          senderName: senderName.trim() || undefined,
        });
        if (result.parseStatus === 'parsed') {
          toast.success('Parsed into a ScoutLead');
        } else if (result.parseStatus === 'manual_review') {
          toast.info('Queued for manual review in Action Centre');
        } else {
          toast.warning(`Intake saved (status: ${result.parseStatus})`);
        }
        setRawText('');
        setGroupName('');
        setSenderName('');
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to submit intake'
        );
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label htmlFor="intake-raw-text" className="mb-1.5 block">
          Message
        </Label>
        <Textarea
          id="intake-raw-text"
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          rows={6}
          placeholder={`e.g. "3 bed terraced in M14, probate sale, asking 180k, quick sale wanted, call Dave on 07..."`}
          disabled={isPending}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <Label htmlFor="intake-source" className="mb-1.5 block">
            Source
          </Label>
          <Select
            value={source}
            onValueChange={(v) => setSource(v as 'paste' | 'share_sheet')}
            disabled={isPending}
          >
            <SelectTrigger id="intake-source">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="paste">Paste</SelectItem>
              <SelectItem value="share_sheet">Share sheet</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="intake-group" className="mb-1.5 block">
            Group name (optional)
          </Label>
          <Input
            id="intake-group"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Property Deals UK"
            disabled={isPending}
          />
        </div>

        <div>
          <Label htmlFor="intake-sender" className="mb-1.5 block">
            Sender (optional)
          </Label>
          <Input
            id="intake-sender"
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            placeholder="Dave"
            disabled={isPending}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={onSubmit} disabled={isPending}>
          {isPending ? 'Submitting...' : 'Submit'}
        </Button>
      </div>
    </div>
  );
}
