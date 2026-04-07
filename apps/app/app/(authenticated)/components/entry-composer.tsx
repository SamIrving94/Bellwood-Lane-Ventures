'use client';

import { Button } from '@repo/design-system/components/ui/button';
import { Textarea } from '@repo/design-system/components/ui/textarea';
import { cn } from '@repo/design-system/lib/utils';
import { ImageIcon, XIcon } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { createEntry } from '../../actions/entries/create';
import { VoiceRecorder } from './voice-recorder';

const MOODS = [
  { emoji: '🤩', label: 'Amazing' },
  { emoji: '😊', label: 'Good' },
  { emoji: '😐', label: 'Okay' },
  { emoji: '😔', label: 'Low' },
  { emoji: '😤', label: 'Frustrated' },
];

export const EntryComposer = () => {
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = () => {
    if (!content.trim() && !imageFile) return;
    setError(null);

    startTransition(async () => {
      let imageUrl: string | undefined;

      // Upload image first if present
      if (imageFile) {
        try {
          const formData = new FormData();
          formData.append('file', imageFile);
          const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          });
          if (!res.ok) throw new Error();
          const { url } = await res.json();
          imageUrl = url;
        } catch {
          setError('Failed to upload image. Please try again.');
          return;
        }
      }

      const result = await createEntry(content, mood ?? undefined, imageUrl);
      if ('error' in result) {
        setError('Failed to save entry. Please try again.');
      } else {
        setContent('');
        setMood(null);
        removeImage();
        toast.success('Entry saved');
        router.refresh();
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="What's on your mind today?"
        className="min-h-32 resize-none text-base"
        disabled={isPending}
      />

      {/* Image preview */}
      {imagePreview && (
        <div className="relative w-fit">
          <Image
            src={imagePreview}
            alt="Attached image"
            width={200}
            height={200}
            className="rounded-lg border object-cover"
            style={{ maxHeight: 200 }}
          />
          <button
            type="button"
            onClick={removeImage}
            className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground shadow-sm"
            aria-label="Remove image"
          >
            <XIcon className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Mood picker */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground" id="mood-label">How are you feeling?</span>
        <div className="flex gap-1" role="radiogroup" aria-labelledby="mood-label">
          {MOODS.map((m) => (
            <button
              key={m.emoji}
              type="button"
              onClick={() => setMood(mood === m.emoji ? null : m.emoji)}
              aria-label={m.label}
              aria-pressed={mood === m.emoji}
              className={cn(
                'rounded-lg p-1.5 text-lg transition-all hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                mood === m.emoji
                  ? 'bg-primary/10 ring-2 ring-primary/40'
                  : 'opacity-50 hover:opacity-100'
              )}
            >
              {m.emoji}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          <kbd className="hidden sm:inline">Ctrl + Enter to save</kbd>
        </p>
        <div className="flex items-center gap-1">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handleImageSelect}
            className="hidden"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={isPending}
            aria-label="Attach image"
            title="Attach image"
          >
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
          </Button>
          <VoiceRecorder
            onTranscription={(text) => setContent((prev) => (prev ? `${prev} ${text}` : text))}
          />
          <Button
            onClick={handleSubmit}
            disabled={isPending || (!content.trim() && !imageFile)}
            size="sm"
          >
            {isPending ? 'Saving…' : 'Save entry'}
          </Button>
        </div>
      </div>
    </div>
  );
};
