'use client';

import { Button } from '@repo/design-system/components/ui/button';
import { ChevronDownIcon, ChevronUpIcon, SettingsIcon } from 'lucide-react';
import { useState } from 'react';

type EvalConfigCardProps = {
  evalType: string;
  label: string;
  description: string;
  activeVersion: number | null;
  totalVersions: number;
  config: Record<string, unknown> | null;
  activatedAt: Date | null;
};

export function EvalConfigCard({
  evalType,
  label,
  description,
  activeVersion,
  totalVersions,
  config,
  activatedAt,
}: EvalConfigCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <SettingsIcon className="mt-0.5 h-5 w-5 text-muted-foreground" />
          <div>
            <h3 className="font-medium">{label}</h3>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        {activeVersion !== null && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
            v{activeVersion}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
        {activeVersion !== null ? (
          <>
            <span>Active: v{activeVersion}</span>
            <span>&middot;</span>
            <span>{totalVersions} version{totalVersions !== 1 ? 's' : ''}</span>
            {activatedAt && (
              <>
                <span>&middot;</span>
                <span>Since {new Date(activatedAt).toLocaleDateString('en-GB')}</span>
              </>
            )}
          </>
        ) : (
          <span>No active config</span>
        )}
      </div>

      {/* Expandable config view */}
      {config && (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <ChevronUpIcon className="mr-1 h-3 w-3" />
            ) : (
              <ChevronDownIcon className="mr-1 h-3 w-3" />
            )}
            {expanded ? 'Hide' : 'View'} config
          </Button>

          {expanded && (
            <div className="mt-2 rounded bg-muted p-3">
              <pre className="text-xs overflow-auto whitespace-pre-wrap">
                {JSON.stringify(config, null, 2)}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}
