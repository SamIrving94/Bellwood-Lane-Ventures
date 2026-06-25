'use client';

import { resolveAction } from '@/app/actions/founder-actions/resolve';
import { publishMarketingDraft } from '@/app/actions/marketing/publish';
import { Button } from '@repo/design-system/components/ui/button';
import {
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  XCircleIcon,
} from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { MARKETING_TYPE_LABELS } from '../lib/marketing-types';
import {
  asMeta,
  getObjectArray,
  getString,
  getStringArray,
  readPublishNotBefore,
} from '../lib/metadata';

export type MarketingAction = {
  id: string;
  type: string;
  priority: string;
  status: string;
  title: string;
  description: string | null;
  agent: string;
  dealId: string | null;
  metadata: unknown;
  createdAt: Date;
};

const priorityStyles: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  critical: {
    bg: 'bg-red-100 dark:bg-red-950',
    text: 'text-red-700 dark:text-red-400',
    label: 'Critical',
  },
  high: {
    bg: 'bg-amber-100 dark:bg-amber-950',
    text: 'text-amber-700 dark:text-amber-400',
    label: 'High',
  },
  medium: {
    bg: 'bg-blue-100 dark:bg-blue-950',
    text: 'text-blue-700 dark:text-blue-400',
    label: 'Medium',
  },
  low: {
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-600 dark:text-slate-400',
    label: 'Low',
  },
};

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatPublishDate(d: Date): string {
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Compliance gate (marketing plan §11): some actions carry
 * `metadata.publishNotBefore`. If that date is in the future the card stays
 * visible but greys out and shows a "Publishes after …" badge — so the
 * founder can see what's coming without being able to act early.
 */
function ComplianceBadge({ until }: { until: Date }) {
  return (
    <span
      data-tour="marketing-anonymisation"
      className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-medium text-[10px] text-amber-800 uppercase tracking-wide dark:bg-amber-950 dark:text-amber-300"
    >
      Publishes after {formatPublishDate(until)}
    </span>
  );
}

export function MarketingCard({ action }: { action: MarketingAction }) {
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const style = priorityStyles[action.priority] ?? priorityStyles.medium;
  const meta = asMeta(action.metadata);
  const publishNotBefore = readPublishNotBefore(meta);
  const isGated = publishNotBefore && publishNotBefore.getTime() > Date.now();

  // Which drafts can be auto-published to a social platform.
  const isSocialPost =
    action.type === 'approve_ig_post' ||
    action.type === 'approve_linkedin_post';

  const handleResolve = (resolution: 'completed' | 'dismissed') => {
    startTransition(async () => {
      await resolveAction(action.id, resolution);
    });
  };

  const handlePublish = () => {
    startTransition(async () => {
      const res = await publishMarketingDraft(action.id);
      if (!res.ok) {
        toast.error(res.error ?? 'Publish failed');
        return;
      }
      toast.success(
        res.status === 'skipped'
          ? 'Approved — connect Ayrshare to post automatically'
          : res.status === 'scheduled'
            ? 'Scheduled'
            : 'Published'
      );
    });
  };

  return (
    <div
      data-tour="marketing-queue-row"
      className={`rounded-lg border bg-card p-4 transition-opacity ${
        isPending ? 'opacity-50' : ''
      } ${isGated ? 'opacity-50' : ''}`}
      data-publish-not-before={publishNotBefore?.toISOString()}
    >
      {/* Header: priority + type + meta */}
      <div className="flex items-start gap-3">
        <div
          className={`shrink-0 rounded-full px-2 py-0.5 font-medium text-xs ${style.bg} ${style.text}`}
        >
          {style.label}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-medium leading-tight">{action.title}</h3>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
            <span className="capitalize">
              {MARKETING_TYPE_LABELS[action.type] ??
                action.type.replace(/_/g, ' ')}
            </span>
            <span>&middot;</span>
            <span>{timeAgo(action.createdAt)}</span>
            {isGated && publishNotBefore && (
              <ComplianceBadge until={publishNotBefore} />
            )}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => setExpanded(!expanded)}
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? (
            <ChevronUpIcon className="h-4 w-4" />
          ) : (
            <ChevronDownIcon className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Per-type body */}
      <div className="mt-3">
        <TypeBody
          type={action.type}
          meta={meta}
          expanded={expanded}
          action={action}
        />
      </div>

      {/* Resolve actions — always available, even on gated cards (founder
          can still dismiss something they don't want), but disabled while a
          publish-window is in the future. */}
      <div className="mt-3 flex items-center gap-2">
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleResolve('dismissed')}
          disabled={isPending}
        >
          <XCircleIcon className="mr-1 h-3 w-3" />
          Dismiss
        </Button>
        <Button
          variant={isSocialPost ? 'ghost' : 'default'}
          size="sm"
          onClick={() => handleResolve('completed')}
          disabled={isPending || isGated}
          title={isGated ? 'Locked until publish window opens' : undefined}
        >
          <CheckCircleIcon className="mr-1 h-3 w-3" />
          Approve
        </Button>
        {isSocialPost && (
          <Button
            size="sm"
            onClick={handlePublish}
            disabled={isPending || isGated}
            title={
              isGated
                ? 'Locked until publish window opens'
                : 'Approve and publish to the social platform'
            }
          >
            <CheckCircleIcon className="mr-1 h-3 w-3" />
            Approve &amp; publish
          </Button>
        )}
      </div>
    </div>
  );
}

function TypeBody({
  type,
  meta,
  expanded,
  action,
}: {
  type: string;
  meta: ReturnType<typeof asMeta>;
  expanded: boolean;
  action: MarketingAction;
}) {
  switch (type) {
    case 'approve_ig_post':
    case 'approve_case_study':
      return <ImageCaptionBody meta={meta} />;
    case 'approve_blog_draft':
      return (
        <BlogBody
          meta={meta}
          expanded={expanded}
          description={action.description}
        />
      );
    case 'approve_linkedin_post':
      return <LinkedInBody meta={meta} />;
    case 'approve_solicitor_outreach':
    case 'approve_outreach_draft':
      return <OutreachBody meta={meta} />;
    case 'approve_paid_ad_copy':
      return <PaidAdBody meta={meta} />;
    default:
      return (
        <GenericBody description={action.description} expanded={expanded} />
      );
  }
}

// ─── Per-type renderers ───────────────────────────────────────────────

function ImageCaptionBody({ meta }: { meta: ReturnType<typeof asMeta> }) {
  const caption = getString(meta, 'caption') ?? getString(meta, 'body') ?? '';
  const hashtags = getStringArray(meta, 'hashtags');
  const imageUrl = getString(meta, 'imageUrl') ?? getString(meta, 'image');

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="aspect-square w-full max-w-[180px] shrink-0 overflow-hidden rounded-lg border bg-muted">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground text-xs">
            Image preview
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        {caption && (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {caption}
          </p>
        )}
        {hashtags.length > 0 && (
          <p className="text-blue-600 text-sm dark:text-blue-400">
            {hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')}
          </p>
        )}
      </div>
    </div>
  );
}

function BlogBody({
  meta,
  expanded,
  description,
}: {
  meta: ReturnType<typeof asMeta>;
  expanded: boolean;
  description: string | null;
}) {
  const title = getString(meta, 'title');
  const metaDescription = getString(meta, 'metaDescription');
  const body =
    getString(meta, 'body') ?? getString(meta, 'draft') ?? description ?? '';
  const truncated =
    body.length > 300 && !expanded ? `${body.slice(0, 300)}…` : body;

  return (
    <div className="space-y-2">
      {title && <p className="font-medium text-base">{title}</p>}
      {metaDescription && (
        <p className="text-muted-foreground text-xs italic">
          {metaDescription}
        </p>
      )}
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{truncated}</p>
    </div>
  );
}

function LinkedInBody({ meta }: { meta: ReturnType<typeof asMeta> }) {
  // metadata.topics is the canonical shape — array of { topic, hook } objects.
  // Fall back to a flat string[] if topics are simple strings.
  const topics = getObjectArray(meta, 'topics');
  const stringTopics =
    topics.length === 0 ? getStringArray(meta, 'topics') : [];

  if (topics.length === 0 && stringTopics.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No topics on this draft yet.
      </p>
    );
  }

  return (
    <ol className="space-y-2 text-sm">
      {topics.map((t, i) => {
        const topic =
          getString(t, 'topic') ?? getString(t, 'title') ?? `Topic ${i + 1}`;
        const hook = getString(t, 'hook') ?? getString(t, 'opener');
        return (
          <li
            key={i}
            className="rounded border-blue-300 border-l-2 bg-slate-50/50 px-3 py-2 dark:bg-slate-900/30"
          >
            <p className="font-medium">{topic}</p>
            {hook && (
              <p className="mt-0.5 text-muted-foreground text-xs">{hook}</p>
            )}
          </li>
        );
      })}
      {stringTopics.map((t, i) => (
        <li
          key={i}
          className="rounded border-blue-300 border-l-2 bg-slate-50/50 px-3 py-2 dark:bg-slate-900/30"
        >
          <p>{t}</p>
        </li>
      ))}
    </ol>
  );
}

function OutreachBody({ meta }: { meta: ReturnType<typeof asMeta> }) {
  const subject = getString(meta, 'subject') ?? getString(meta, 'emailSubject');
  const body = getString(meta, 'body') ?? getString(meta, 'emailBody') ?? '';
  const linkedinDm =
    getString(meta, 'linkedinDm') ?? getString(meta, 'linkedInDm');

  const truncatedBody = body.length > 150 ? `${body.slice(0, 150)}…` : body;

  return (
    <div className="space-y-3 text-sm">
      <div className="rounded-md border bg-slate-50/60 p-3 dark:bg-slate-900/30">
        {subject && (
          <p className="mb-1 font-mono text-muted-foreground text-xs uppercase tracking-wider">
            Subject
          </p>
        )}
        {subject && <p className="font-medium">{subject}</p>}
        {truncatedBody && (
          <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
            {truncatedBody}
          </p>
        )}
      </div>
      {linkedinDm && (
        <div className="rounded-md border border-blue-200 bg-blue-50/60 p-3 dark:border-blue-900 dark:bg-blue-950/30">
          <p className="mb-1 font-mono text-blue-700 text-xs uppercase tracking-wider dark:text-blue-300">
            LinkedIn DM
          </p>
          <p className="whitespace-pre-wrap text-muted-foreground">
            {linkedinDm}
          </p>
        </div>
      )}
    </div>
  );
}

function PaidAdBody({ meta }: { meta: ReturnType<typeof asMeta> }) {
  const headlines = getStringArray(meta, 'headlines');
  const bodyCopies = getStringArray(meta, 'bodyCopies');
  const bodies =
    bodyCopies.length > 0 ? bodyCopies : getStringArray(meta, 'bodies');
  const variants = getObjectArray(meta, 'variants');

  // Prefer explicit headline × body matrix when both present
  if (headlines.length > 0 && bodies.length > 0) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50/60 dark:bg-slate-900/30">
            <tr>
              <th className="border px-2 py-1.5 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider">
                Headline / Body
              </th>
              {bodies.map((b, j) => (
                <th
                  key={j}
                  className="border px-2 py-1.5 text-left font-mono text-muted-foreground text-xs"
                >
                  B{j + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {headlines.map((h, i) => (
              <tr key={i}>
                <td className="border bg-slate-50/40 px-2 py-1.5 font-medium dark:bg-slate-900/20">
                  {h}
                </td>
                {bodies.map((b, j) => (
                  <td
                    key={j}
                    className="border px-2 py-1.5 text-muted-foreground text-xs"
                  >
                    {b}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Fallback: list a variants[] array if that's what the cron writes.
  if (variants.length > 0) {
    return (
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {variants.map((v, i) => (
          <div key={i} className="rounded border p-2 text-sm">
            <p className="font-medium">
              {getString(v, 'headline') ?? `Variant ${i + 1}`}
            </p>
            {getString(v, 'body') && (
              <p className="mt-1 text-muted-foreground text-xs">
                {getString(v, 'body')}
              </p>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <p className="text-muted-foreground text-sm">
      No ad variants supplied on this draft.
    </p>
  );
}

function GenericBody({
  description,
  expanded,
}: {
  description: string | null;
  expanded: boolean;
}) {
  if (!description) return null;
  const text =
    expanded || description.length <= 240
      ? description
      : `${description.slice(0, 240)}…`;
  return (
    <p className="whitespace-pre-wrap text-muted-foreground text-sm">{text}</p>
  );
}
