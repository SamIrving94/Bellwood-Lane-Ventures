import type { JournalEntry } from '@repo/database';
import { CalendarIcon, FlameIcon } from 'lucide-react';
import { EntryCard } from './entry-card';

type ThisDayGroup = {
  yearsAgo: number;
  entries: JournalEntry[];
};

type DashboardStatsProps = {
  streak: number;
  moodCounts: Record<string, number>;
  thisDayByYear: ThisDayGroup[];
};

export const DashboardStats = ({
  streak,
  moodCounts,
  thisDayByYear,
}: DashboardStatsProps) => {
  const hasMoods = Object.keys(moodCounts).length > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Stats row */}
      <div className="flex flex-wrap gap-3">
        {/* Streak */}
        <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2.5">
          <FlameIcon className="h-4 w-4 text-orange-500" />
          <span className="text-sm font-medium">
            {streak === 0 ? 'No streak yet' : `${streak}-day streak`}
          </span>
        </div>

        {/* Mood summary (last 7 days) */}
        {hasMoods && (
          <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2.5">
            <span className="text-xs text-muted-foreground">This week:</span>
            <div className="flex gap-1.5">
              {Object.entries(moodCounts).map(([emoji, count]) => (
                <span key={emoji} className="text-sm" title={`${count}x`}>
                  {emoji}
                  {count > 1 && (
                    <span className="text-xs text-muted-foreground">
                      {count}
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* This day in previous years */}
      {thisDayByYear.map(({ yearsAgo, entries }) => (
        <section key={yearsAgo}>
          <div className="mb-2 flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-medium text-muted-foreground">
              This day {yearsAgo === 1 ? 'last year' : `${yearsAgo} years ago`}
            </h2>
          </div>
          <div className="flex flex-col gap-3">
            {entries.map((entry) => (
              <EntryCard key={entry.id} entry={entry} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};
