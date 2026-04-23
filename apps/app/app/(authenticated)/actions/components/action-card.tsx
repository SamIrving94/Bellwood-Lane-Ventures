'use client';

import { Button } from '@repo/design-system/components/ui/button';
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ExternalLinkIcon,
  XCircleIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { resolveAction } from '@/app/actions/founder-actions/resolve';
import { checkFeedbackCompletion } from '@/app/actions/founder-actions/check-feedback';
import { StarRatingInline } from '../../components/star-rating-inline';

type Action = {
  id: string;
  type: string;
  priority: string;
  status: string;
  title: string;
  description: string | null;
  agent: string;
  dealId: string | null;
  createdAt: Date;
};

type ReviewLead = {
  id: string;
  address: string;
  postcode: string;
  leadScore: number;
  verdict: string;
  existingRating: number;
};

const priorityStyles: Record<string, { bg: string; text: string; label: string }> = {
  critical: { bg: 'bg-red-100 dark:bg-red-950', text: 'text-red-700 dark:text-red-400', label: 'Critical' },
  high: { bg: 'bg-amber-100 dark:bg-amber-950', text: 'text-amber-700 dark:text-amber-400', label: 'High' },
  medium: { bg: 'bg-blue-100 dark:bg-blue-950', text: 'text-blue-700 dark:text-blue-400', label: 'Medium' },
  low: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-400', label: 'Low' },
};

const agentLabels: Record<string, string> = {
  scout: 'Scout',
  appraiser: 'Appraiser',
  counsel: 'Counsel',
  marketer: 'Marketer',
  liaison: 'Liaison',
  cto: 'CTO',
  orchestrator: 'Orchestrator',
  system: 'System',
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

const verdictColors: Record<string, string> = {
  STRONG: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  VIABLE: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  THIN: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  PASS: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  INSUFFICIENT_DATA: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

export function ActionCard({ action, reviewLeads }: { action: Action; reviewLeads?: ReviewLead[] }) {
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [showFeedbackWarning, setShowFeedbackWarning] = useState(false);
  const [localRatings, setLocalRatings] = useState<Record<string, number>>({});
  const style = priorityStyles[action.priority] ?? priorityStyles.medium;

  const handleResolve = (resolution: 'completed' | 'dismissed') => {
    startTransition(async () => {
      await resolveAction(action.id, resolution);
    });
  };

  const handleDoneClick = () => {
    // For review_leads actions, warn if no feedback has been submitted
    if (action.type === 'review_leads') {
      startTransition(async () => {
        const hasRatedAny = await checkFeedbackCompletion(action.id);
        if (!hasRatedAny) {
          setShowFeedbackWarning(true);
        } else {
          await resolveAction(action.id, 'completed');
        }
      });
    } else {
      handleResolve('completed');
    }
  };

  return (
    <div
      className={`rounded-lg border bg-card p-4 transition-opacity ${isPending ? 'opacity-50' : ''}`}
    >
      <div className="flex items-start gap-3">
        {/* Priority badge */}
        <div className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}>
          {style.label}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <h3 className="font-medium leading-tight">{action.title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {agentLabels[action.agent] ?? action.agent} &middot; {timeAgo(action.createdAt)}
            {action.type !== 'general' && (
              <> &middot; <span className="capitalize">{action.type.replace(/_/g, ' ')}</span></>
            )}
          </p>

          {/* Expandable description */}
          {action.description && expanded && (
            <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
              {action.description}
            </p>
          )}
        </div>

        {/* Expand toggle */}
        {action.description && (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
          </Button>
        )}
      </div>

      {/* Inline lead raters for review_leads actions */}
      {action.type === 'review_leads' && reviewLeads && reviewLeads.length > 0 && (
        <div className="mt-3 space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Top unrated leads — rate inline or{' '}
            <Link href="/leads?filter=unrated" className="underline hover:text-foreground">
              view all
            </Link>
          </p>
          <div className="rounded-lg border divide-y">
            {reviewLeads.map((lead) => {
              const rating = localRatings[lead.id] ?? lead.existingRating;
              return (
                <div
                  key={lead.id}
                  className="flex items-center gap-3 px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/leads/${lead.id}`}
                      className="font-medium hover:underline truncate block"
                    >
                      {lead.address}
                    </Link>
                    <p className="text-xs text-muted-foreground">{lead.postcode}</p>
                  </div>
                  <span className="font-mono text-xs shrink-0">{lead.leadScore}</span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      verdictColors[lead.verdict] ?? ''
                    }`}
                  >
                    {lead.verdict}
                  </span>
                  <div className="relative shrink-0">
                    <StarRatingInline
                      targetType="scout_lead"
                      targetId={lead.id}
                      existingRating={rating}
                      compact
                      onRated={(r) =>
                        setLocalRatings((prev) => ({ ...prev, [lead.id]: r }))
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Feedback completion warning */}
      {showFeedbackWarning && (
        <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950">
          <div className="flex items-start gap-2">
            <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="flex-1 text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-300">
                No leads have been rated yet
              </p>
              <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
                Rating leads helps improve scouting accuracy. You can still mark Done without rating.
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              asChild
              onClick={() => setShowFeedbackWarning(false)}
            >
              <Link href="/leads?filter=unrated">
                Rate Leads
              </Link>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleResolve('completed')}
              disabled={isPending}
            >
              Skip and Mark Done
            </Button>
          </div>
        </div>
      )}

      {/* Actions */}
      {!showFeedbackWarning && (
        <div className="mt-3 flex items-center gap-2">
          {action.dealId && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/deals/${action.dealId}`}>
                <ExternalLinkIcon className="mr-1 h-3 w-3" />
                View Deal
              </Link>
            </Button>
          )}
          {action.type === 'review_leads' && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/leads?filter=unrated">
                <ExternalLinkIcon className="mr-1 h-3 w-3" />
                View Leads
              </Link>
            </Button>
          )}
          {action.type === 'review_campaign' && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/outreach">
                <ExternalLinkIcon className="mr-1 h-3 w-3" />
                View Campaign
              </Link>
            </Button>
          )}
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
            size="sm"
            onClick={handleDoneClick}
            disabled={isPending}
          >
            <CheckCircleIcon className="mr-1 h-3 w-3" />
            Done
          </Button>
        </div>
      )}
    </div>
  );
}
