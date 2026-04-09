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

export function ActionCard({ action }: { action: Action }) {
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const style = priorityStyles[action.priority] ?? priorityStyles.medium;

  const handleResolve = (resolution: 'completed' | 'dismissed') => {
    startTransition(async () => {
      await resolveAction(action.id, resolution);
    });
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

      {/* Actions */}
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
            <Link href="/leads?status=new&minScore=70">
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
          onClick={() => handleResolve('completed')}
          disabled={isPending}
        >
          <CheckCircleIcon className="mr-1 h-3 w-3" />
          Done
        </Button>
      </div>
    </div>
  );
}
