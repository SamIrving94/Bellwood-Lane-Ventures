'use client';

import { Button } from '@repo/design-system/components/ui/button';
import { Textarea } from '@repo/design-system/components/ui/textarea';
import { cn } from '@repo/design-system/lib/utils';
import type { JournalEntry } from '@repo/database';
import { format } from 'date-fns';
import { MessageSquareIcon, PencilIcon, Trash2Icon, XIcon } from 'lucide-react';
import Image from 'next/image';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { deleteEntry } from '../../actions/entries/delete';
import { updateEntry } from '../../actions/entries/update';

const MOODS = [
  { emoji: '🤩', label: 'Amazing' },
  { emoji: '😊', label: 'Good' },
  { emoji: '😐', label: 'Okay' },
  { emoji: '😔', label: 'Low' },
  { emoji: '😤', label: 'Frustrated' },
];

type EntryCardProps = {
  entry: JournalEntry;
  onDeleted?: (id: string) => void;
  onUpdated?: (entry: JournalEntry) => void;
};

export const EntryCard = ({ entry, onDeleted, onUpdated }: EntryCardProps) => {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(entry.content);
  const [editMood, setEditMood] = useState<string | null>(entry.mood);

  const handleDelete = () => {
    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
      return;
    }
    startTransition(async () => {
      const result = await deleteEntry(entry.id);
      if (!('error' in result)) {
        onDeleted?.(entry.id);
      }
      setConfirming(false);
    });
  };

  const handleEdit = () => {
    setEditContent(entry.content);
    setEditMood(entry.mood);
    setEditing(true);
  };

  const handleCancelEdit = () => {
    setEditing(false);
  };

  const handleSaveEdit = () => {
    if (!editContent.trim()) return;
    startTransition(async () => {
      const result = await updateEntry(entry.id, editContent, editMood);
      if ('error' in result) {
        toast.error('Failed to update entry');
      } else {
        toast.success('Entry updated');
        setEditing(false);
        onUpdated?.(result.data);
      }
    });
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      handleSaveEdit();
    }
    if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  return (
    <article className="group rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            {!editing && entry.mood && (
              <span className="text-lg leading-none" title="Mood">
                {entry.mood}
              </span>
            )}
            <time className="text-sm font-medium text-muted-foreground">
              {format(new Date(entry.createdAt), 'EEEE, MMMM d, yyyy · h:mm a')}
            </time>
            {entry.source === 'whatsapp' && (
              <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                <MessageSquareIcon className="h-3 w-3" />
                WhatsApp
              </span>
            )}
          </div>

          {/* Image */}
          {entry.imageUrl && (
            <div className="mb-3">
              <Image
                src={entry.imageUrl}
                alt="Journal entry image"
                width={400}
                height={300}
                className="rounded-lg border object-cover"
                style={{ maxHeight: 300, width: 'auto' }}
              />
            </div>
          )}

          {editing ? (
            <div className="flex flex-col gap-3">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={handleEditKeyDown}
                className="min-h-24 resize-none text-sm"
                disabled={isPending}
                autoFocus
              />

              {/* Mood picker */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Mood:</span>
                <div className="flex gap-1">
                  {MOODS.map((m) => (
                    <button
                      key={m.emoji}
                      type="button"
                      onClick={() =>
                        setEditMood(editMood === m.emoji ? null : m.emoji)
                      }
                      aria-label={m.label}
                      aria-pressed={editMood === m.emoji}
                      className={cn(
                        'rounded-lg p-1 text-base transition-all hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        editMood === m.emoji
                          ? 'bg-primary/10 ring-2 ring-primary/40'
                          : 'opacity-50 hover:opacity-100'
                      )}
                    >
                      {m.emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSaveEdit}
                  disabled={isPending || !editContent.trim()}
                >
                  {isPending ? 'Saving…' : 'Save'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCancelEdit}
                  disabled={isPending}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {entry.content}
            </p>
          )}
        </div>

        {!editing && (
          <div className="flex shrink-0 gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
              onClick={handleEdit}
              disabled={isPending}
              aria-label="Edit entry"
            >
              <PencilIcon className="h-4 w-4 text-muted-foreground" />
            </Button>
            <Button
              variant={confirming ? 'destructive' : 'ghost'}
              size={confirming ? 'sm' : 'icon'}
              className={
                confirming
                  ? ''
                  : 'opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100'
              }
              onClick={handleDelete}
              disabled={isPending}
              aria-label={confirming ? 'Confirm delete' : 'Delete entry'}
            >
              {confirming ? (
                <span className="text-xs">Delete?</span>
              ) : (
                <Trash2Icon className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
        )}

        {editing && (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={handleCancelEdit}
            aria-label="Cancel editing"
          >
            <XIcon className="h-4 w-4 text-muted-foreground" />
          </Button>
        )}
      </div>
    </article>
  );
};
