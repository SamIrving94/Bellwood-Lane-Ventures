'use client';

import { Button } from '@repo/design-system/components/ui/button';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { saveStrategyDoc } from './actions';

type Props = {
  initialMarkdown: string;
  updatedBy: string | null;
  updatedAt: string | null;
};

export function StrategyDoc({ initialMarkdown, updatedBy, updatedAt }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialMarkdown);
  const [saved, setSaved] = useState(initialMarkdown);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSave() {
    setError(null);
    startTransition(async () => {
      const result = await saveStrategyDoc(draft);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(draft);
      setEditing(false);
      router.refresh();
    });
  }

  function onCancel() {
    setDraft(saved);
    setEditing(false);
    setError(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {updatedAt
            ? `Last edited ${new Date(updatedAt).toLocaleString('en-GB')}`
            : 'Starter version — not yet edited in-app'}
        </p>
        {editing ? (
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onCancel} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={onSave} disabled={isPending}>
              {isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        ) : (
          <Button variant="outline" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {editing ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck
            className="min-h-[70vh] w-full rounded-lg border bg-background p-4 font-mono text-sm leading-relaxed"
          />
          <div className="rounded-lg border bg-card p-6">
            <Rendered markdown={draft} />
          </div>
        </div>
      ) : (
        <div className="rounded-lg border bg-card p-6 sm:p-8">
          <Rendered markdown={saved} />
        </div>
      )}
    </div>
  );
}

/**
 * Render markdown as readable HTML. Larger base text, generous line-height and
 * a capped line length make it easier to read (dyslexia-friendly), via the
 * Tailwind typography `prose` styles.
 */
function Rendered({ markdown }: { markdown: string }) {
  return (
    <article className="prose prose-slate dark:prose-invert max-w-[68ch] text-[1.05rem] leading-8 prose-headings:font-bold prose-h1:text-3xl prose-h2:mt-10 prose-h2:border-b prose-h2:pb-1 prose-li:my-1 prose-strong:text-foreground">
      <Markdown remarkPlugins={[remarkGfm]}>{markdown}</Markdown>
    </article>
  );
}
