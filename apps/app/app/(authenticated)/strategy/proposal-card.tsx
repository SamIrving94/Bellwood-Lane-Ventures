'use client';

import { Button } from '@repo/design-system/components/ui/button';
import { useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Props = {
  title: string;
  date: string;
  reviewer: string;
  markdown: string;
  /** The newest for_review proposal starts expanded. */
  defaultOpen?: boolean;
};

export function ProposalCard({
  title,
  date,
  reviewer,
  markdown,
  defaultOpen = false,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/30">
      <div className="flex flex-wrap items-center justify-between gap-2 p-4">
        <div>
          <p className="font-semibold">{title}</p>
          <p className="text-muted-foreground text-xs">
            Raised {new Date(date).toLocaleDateString('en-GB')} · needs{' '}
            <span className="font-medium text-foreground">{reviewer}</span> to
            review
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
          {open ? 'Collapse' : 'Read proposal'}
        </Button>
      </div>
      {open && (
        <div className="border-amber-200 border-t p-6 sm:p-8 dark:border-amber-900">
          {/* Same reading styles as the live decision stack. */}
          <article className="prose prose-slate dark:prose-invert max-w-[68ch] text-[1.05rem] leading-8 prose-headings:font-bold prose-h2:mt-10 prose-h2:border-b prose-h2:pb-1 prose-li:my-1 prose-strong:text-foreground">
            <Markdown remarkPlugins={[remarkGfm]}>{markdown}</Markdown>
          </article>
        </div>
      )}
    </div>
  );
}
