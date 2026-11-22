import { Button, Eyebrow } from '@/components/brand';
import { isHiddenPath } from '@/lib/public-sections';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';

/**
 * The body of one guide, as a reader sees it. Shared by the live page
 * (/guides/[slug]) and the founder preview (/guides/preview/[id]) so the
 * preview can never drift from what actually goes out.
 */

export type GuideSource = {
  title: string;
  url: string;
  source: string;
  publishedAt?: string;
};

export type GuideArticleData = {
  h1: string;
  hook: string | null;
  bodyMarkdown: string;
  ctaLine: string;
  ctaHref: string;
  sources: unknown;
};

const dateFmt = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/**
 * Markdown from the drafter, rendered with a deliberately narrow element
 * set: headings, paragraphs, lists, links, emphasis. No raw HTML passes
 * through (react-markdown's default), so a model cannot inject markup even
 * if it tried.
 *
 * `date` is the date shown under "Guides": the publish date when live, and
 * today in a preview (the date it would carry if published now).
 */
export function GuideArticle({
  guide,
  date,
}: {
  guide: GuideArticleData;
  date: Date;
}) {
  const sources = (
    Array.isArray(guide.sources) ? guide.sources : []
  ) as GuideSource[];

  return (
    <article className="max-w-3xl pt-9 md:pt-[52px]">
      <p className="font-mono text-[11px] text-stone-500 uppercase tracking-[0.14em]">
        <Link href="/guides" className="hover:text-brand-deep">
          Guides
        </Link>
        {` · ${dateFmt.format(date)}`}
      </p>
      <h1
        className="mt-4 text-balance font-bold font-serif text-forest leading-[1.06] tracking-[-0.03em]"
        style={{ fontSize: 'clamp(30px, 4vw, 48px)' }}
      >
        {guide.h1}
      </h1>
      {guide.hook && (
        <p className="mt-5 font-serif text-[19px] text-stone-700 leading-relaxed">
          {guide.hook}
        </p>
      )}

      <div className="prose-kept mt-8">
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
              <h2 className="mt-10 font-serif text-[26px] text-forest leading-snug">
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="mt-7 font-semibold text-[18px] text-forest">
                {children}
              </h3>
            ),
            p: ({ children }) => (
              <p className="mt-4 text-[16.5px] text-stone-700 leading-[1.7]">
                {children}
              </p>
            ),
            ul: ({ children }) => (
              <ul className="mt-4 list-disc space-y-2 pl-6 text-[16.5px] text-stone-700 leading-[1.7]">
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol className="mt-4 list-decimal space-y-2 pl-6 text-[16.5px] text-stone-700 leading-[1.7]">
                {children}
              </ol>
            ),
            a: ({ href, children }) => {
              const external = !!href && /^https?:\/\//i.test(href);
              return (
                <a
                  href={href}
                  className="text-leaf underline underline-offset-2 hover:text-leaf-dark"
                  {...(external ? { rel: 'noreferrer', target: '_blank' } : {})}
                >
                  {children}
                </a>
              );
            },
            blockquote: ({ children }) => (
              <blockquote className="mt-6 border-leaf border-l-2 pl-5 text-stone-600 italic">
                {children}
              </blockquote>
            ),
          }}
        >
          {guide.bodyMarkdown}
        </ReactMarkdown>
      </div>

      {/* A guide written before a section was hidden may still point
          into it; drop the box rather than CTA to a 404. */}
      {!isHiddenPath(guide.ctaHref) && (
        <section className="mt-12 rounded-sm border border-hair bg-secondary/60 p-6">
          <Eyebrow>next step</Eyebrow>
          <p className="mt-3 font-serif text-[19px] text-forest leading-snug">
            {guide.ctaLine}
          </p>
          <Button href={guide.ctaHref} className="mt-4 px-5 py-2 text-sm">
            Read more
          </Button>
        </section>
      )}

      {sources.length > 0 && (
        <section className="mt-10">
          <p className="font-mono text-[11px] text-stone-500 uppercase tracking-[0.14em]">
            Sources
          </p>
          <ul className="mt-3 space-y-1.5 text-[14px] text-stone-600">
            {sources.map((s) => (
              <li key={s.url}>
                <a
                  href={s.url}
                  rel="noreferrer"
                  target="_blank"
                  className="underline underline-offset-2 hover:text-brand-deep"
                >
                  {s.title}
                </a>
                <span className="text-stone-400">
                  {' '}
                  · {s.source}
                  {s.publishedAt ? `, ${s.publishedAt.slice(0, 10)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-10 text-[13px] text-stone-500">
        This guide is an honest steer, not advice. Kept is not FCA authorised.
        For money worries, StepChange and Citizens Advice are free and
        independent.
      </p>
    </article>
  );
}
