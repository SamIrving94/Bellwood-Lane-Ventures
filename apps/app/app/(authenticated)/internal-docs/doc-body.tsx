'use client';

import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** Renders an internal doc's markdown body with GFM (tables, etc.). */
export function DocBody({ body }: { body: string }) {
  return (
    <article className="prose prose-slate max-w-none prose-headings:font-semibold prose-table:text-sm">
      <Markdown remarkPlugins={[remarkGfm]}>{body}</Markdown>
    </article>
  );
}
