'use client';

import { Button } from '@repo/design-system/components/ui/button';
import {
  BookOpenIcon,
  CheckCircleIcon,
  GlobeIcon,
  PencilIcon,
  SaveIcon,
  SearchIcon,
} from 'lucide-react';
import { useRef, useState, useTransition } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  type GuideTextInput,
  saveAndApproveGuide,
  saveAndPublishGuide,
  saveGuideText,
} from '@/app/actions/guides/edit';
import { archiveGuide } from '@/app/actions/guides/publish';

export type ComplianceIssue = {
  ruleSet?: string;
  severity?: string;
  excerpt?: string;
  problem?: string;
  suggestedFix?: string;
};

export type Compliance = {
  overallVerdict?: string;
  issues?: ComplianceIssue[];
  substantiationNeeded?: string[];
  missingSignposts?: string[];
};

const VERDICT_STYLE: Record<string, string> = {
  publish_ready:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  edit_required:
    'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  do_not_publish: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
};

const SEVERITY_STYLE: Record<string, string> = {
  blocker: 'text-red-700 dark:text-red-400',
  high: 'text-red-700 dark:text-red-400',
  medium: 'text-amber-700 dark:text-amber-400',
  low: 'text-muted-foreground',
};

type Field = keyof GuideTextInput;

const FIELDS: { key: Field; label: string; rows: number; hint?: string }[] = [
  { key: 'title', label: 'Title (browser tab and Google)', rows: 1 },
  {
    key: 'metaDescription',
    label: 'Google description',
    rows: 2,
    hint: '140–160 characters reads best',
  },
  { key: 'h1', label: 'Headline on the page', rows: 1 },
  { key: 'hook', label: 'Opening line (optional)', rows: 3 },
  {
    key: 'bodyMarkdown',
    label: 'Body',
    rows: 28,
    hint: '## for a heading, ### for a sub-heading, - for a bullet, **bold**, [link text](https://…)',
  },
  { key: 'ctaLine', label: 'Closing line (next step box)', rows: 2 },
];

/**
 * Read a guide in full, fold Counsel's fixes into it, then approve or
 * publish — all on one screen. "Find in text" jumps to the passage Counsel
 * quoted so the fix can be typed straight in. Saving never publishes;
 * only the Publish button reaches the public site.
 */
export function GuideEditor({
  id,
  status,
  initial,
  compliance,
  slug,
}: {
  readonly id: string;
  readonly status: 'draft' | 'approved';
  readonly initial: GuideTextInput;
  readonly compliance: Compliance;
  readonly slug: string;
}) {
  const [text, setText] = useState<GuideTextInput>(initial);
  const [saved, setSaved] = useState<GuideTextInput>(initial);
  const [mode, setMode] = useState<'read' | 'edit'>('read');
  const [message, setMessage] = useState<{
    tone: 'ok' | 'error';
    text: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const refs = useRef<Partial<Record<Field, HTMLTextAreaElement | null>>>({});

  const dirty = (Object.keys(text) as Field[]).some(
    (k) => text[k] !== saved[k]
  );

  const run = (
    action: typeof saveGuideText,
    done: string,
    confirmText?: string
  ) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setMessage(null);
    startTransition(async () => {
      const result = await action(id, text);
      if (result.ok) {
        setSaved(text);
        setMessage({ tone: 'ok', text: done });
      } else {
        setMessage({ tone: 'error', text: result.error });
      }
    });
  };

  // Jump to the passage Counsel quoted. Excerpts can be trimmed or
  // re-punctuated, so fall back to the first 6 words before giving up.
  const findInText = (excerpt: string) => {
    const needles = [
      excerpt.trim(),
      excerpt.trim().split(/\s+/).slice(0, 6).join(' '),
    ].filter((n) => n.length >= 4);
    for (const field of FIELDS.map((f) => f.key)) {
      const haystack = text[field].toLowerCase();
      for (const needle of needles) {
        const at = haystack.indexOf(needle.toLowerCase());
        if (at === -1) continue;
        setMode('edit');
        setMessage(null);
        // Wait for the edit view to render before selecting.
        requestAnimationFrame(() => {
          const el = refs.current[field];
          if (!el) return;
          el.focus();
          el.setSelectionRange(at, at + needle.length);
          // Scroll the selection into view inside a tall textarea.
          const lineHeight = 20;
          const line = text[field].slice(0, at).split('\n').length;
          el.scrollTop = Math.max(0, (line - 3) * lineHeight);
          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        });
        return;
      }
    }
    setMessage({
      tone: 'error',
      text: 'That passage is not in the text any more. It may already be fixed.',
    });
  };

  const issues = compliance.issues ?? [];
  const toSource = [
    ...(compliance.substantiationNeeded ?? []),
    ...(compliance.missingSignposts ?? []),
  ];
  const verdict = compliance.overallVerdict;

  return (
    <div className="space-y-4">
      {/* Action bar — stays in view while reading a long guide */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border bg-card/95 p-3 backdrop-blur">
        <Button
          size="sm"
          variant={mode === 'read' ? 'default' : 'outline'}
          onClick={() => setMode('read')}
        >
          <BookOpenIcon className="mr-1 h-3 w-3" />
          Read
        </Button>
        <Button
          size="sm"
          variant={mode === 'edit' ? 'default' : 'outline'}
          onClick={() => setMode('edit')}
        >
          <PencilIcon className="mr-1 h-3 w-3" />
          Edit
        </Button>
        {dirty && (
          <span className="text-amber-700 text-xs dark:text-amber-400">
            Unsaved changes
          </span>
        )}
        <div className="flex-1" />
        <Button
          size="sm"
          variant="ghost"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              if (!window.confirm('Archive this guide? It will not go out.'))
                return;
              await archiveGuide(id);
            })
          }
        >
          Archive
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={isPending || !dirty}
          onClick={() => run(saveGuideText, 'Saved.')}
        >
          <SaveIcon className="mr-1 h-3 w-3" />
          Save
        </Button>
        {status === 'draft' && (
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() =>
              run(saveAndApproveGuide, 'Saved and approved. Not live yet.')
            }
          >
            <CheckCircleIcon className="mr-1 h-3 w-3" />
            {dirty ? 'Save & approve' : 'Approve'}
          </Button>
        )}
        <Button
          size="sm"
          disabled={isPending}
          onClick={() =>
            run(
              saveAndPublishGuide,
              `Published. Live at /guides/${slug} within five minutes.`,
              'Publish this guide to the public site now?'
            )
          }
        >
          <GlobeIcon className="mr-1 h-3 w-3" />
          {dirty ? 'Save & publish' : 'Publish'}
        </Button>
      </div>

      {message && (
        <p
          className={`rounded-md px-3 py-2 text-sm ${
            message.tone === 'ok'
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
              : 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300'
          }`}
        >
          {message.text}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 rounded-lg border bg-card p-6">
          {mode === 'read' ? (
            <GuideReader text={text} />
          ) : (
            <div className="space-y-5">
              {FIELDS.map((f) => (
                <label key={f.key} className="block">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-medium text-sm">{f.label}</span>
                    <span className="text-muted-foreground text-xs">
                      {text[f.key].length} chars
                    </span>
                  </span>
                  {f.hint && (
                    <span className="mt-0.5 block text-muted-foreground text-xs">
                      {f.hint}
                    </span>
                  )}
                  <textarea
                    ref={(el) => {
                      refs.current[f.key] = el;
                    }}
                    value={text[f.key]}
                    rows={f.rows}
                    onChange={(e) =>
                      setText((t) => ({ ...t, [f.key]: e.target.value }))
                    }
                    className={`mt-1.5 w-full rounded-md border bg-background px-3 py-2 text-sm leading-5 focus:outline-none focus:ring-2 focus:ring-ring ${
                      f.key === 'bodyMarkdown' ? 'font-mono' : ''
                    }`}
                  />
                </label>
              ))}
            </div>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto">
          <section className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-sm">Counsel’s notes</p>
              {verdict && (
                <span
                  className={`rounded-full px-2 py-0.5 font-medium text-xs ${VERDICT_STYLE[verdict] ?? ''}`}
                >
                  {verdict.replace(/_/g, ' ')}
                </span>
              )}
            </div>
            {!verdict && (
              <p className="mt-2 text-muted-foreground text-sm">
                No compliance report on this guide.
              </p>
            )}
            {verdict && issues.length === 0 && (
              <p className="mt-2 text-muted-foreground text-sm">
                No issues raised.
              </p>
            )}
            <ul className="mt-3 space-y-4">
              {issues.map((issue, i) => (
                <li
                  key={`${issue.ruleSet}-${i}`}
                  className="border-t pt-3 text-sm first:border-0 first:pt-0"
                >
                  <p
                    className={`font-mono text-[11px] uppercase ${SEVERITY_STYLE[issue.severity ?? ''] ?? ''}`}
                  >
                    {issue.severity} · {issue.ruleSet}
                  </p>
                  {issue.excerpt && (
                    <p className="mt-1 text-muted-foreground text-xs italic">
                      “{issue.excerpt}”
                    </p>
                  )}
                  <p className="mt-1">{issue.problem}</p>
                  {issue.suggestedFix && (
                    <p className="mt-1 rounded bg-muted px-2 py-1 text-xs">
                      <span className="font-medium">Fix:</span>{' '}
                      {issue.suggestedFix}
                    </p>
                  )}
                  {issue.excerpt && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-1 h-7 px-2 text-xs"
                      onClick={() => findInText(issue.excerpt ?? '')}
                    >
                      <SearchIcon className="mr-1 h-3 w-3" />
                      Find in text
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            {toSource.length > 0 && (
              <div className="mt-4 border-t pt-3">
                <p className="text-muted-foreground text-xs">
                  Needs a source or a signpost
                </p>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-sm">
                  {toSource.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* How it reads in a search result. */}
          <section className="rounded-lg border bg-card p-4">
            <p className="font-medium text-sm">In Google</p>
            <div className="mt-3 space-y-0.5">
              <p className="truncate text-muted-foreground text-xs">
                wearekept.co.uk › guides › {slug}
              </p>
              <p className="text-[17px] text-blue-700 leading-snug dark:text-blue-400">
                {text.title}
              </p>
              <p className="text-muted-foreground text-sm leading-snug">
                {text.metaDescription}
              </p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

/**
 * The guide as formatted text, in the same order and with the same
 * element set the public page renders (headings, paragraphs, lists,
 * links, emphasis, quotes). Not the site's exact styling.
 */
export function GuideReader({ text }: { readonly text: GuideTextInput }) {
  return (
    <article className="mx-auto max-w-2xl">
      <h1 className="font-semibold text-3xl leading-tight tracking-tight">
        {text.h1}
      </h1>
      {text.hook && (
        <p className="mt-4 font-serif text-lg text-muted-foreground leading-relaxed">
          {text.hook}
        </p>
      )}
      <div className="mt-6">
        <ReactMarkdown
          allowedElements={[
            'p',
            'h2',
            'h3',
            'ul',
            'ol',
            'li',
            'a',
            'strong',
            'em',
            'blockquote',
          ]}
          unwrapDisallowed
          components={{
            h2: ({ children }) => (
              <h2 className="mt-8 font-semibold text-xl">{children}</h2>
            ),
            h3: ({ children }) => (
              <h3 className="mt-6 font-semibold text-base">{children}</h3>
            ),
            p: ({ children }) => (
              <p className="mt-3 text-[15px] leading-7">{children}</p>
            ),
            ul: ({ children }) => (
              <ul className="mt-3 list-disc space-y-1.5 pl-6 text-[15px] leading-7">
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol className="mt-3 list-decimal space-y-1.5 pl-6 text-[15px] leading-7">
                {children}
              </ol>
            ),
            a: ({ href, children }) => (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="text-blue-700 underline underline-offset-2 dark:text-blue-400"
              >
                {children}
              </a>
            ),
            blockquote: ({ children }) => (
              <blockquote className="mt-4 border-l-2 pl-4 text-muted-foreground italic">
                {children}
              </blockquote>
            ),
          }}
        >
          {text.bodyMarkdown}
        </ReactMarkdown>
      </div>
      <div className="mt-8 rounded-md border bg-muted/50 p-4">
        <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
          Next step
        </p>
        <p className="mt-2 font-medium">{text.ctaLine}</p>
      </div>
    </article>
  );
}
