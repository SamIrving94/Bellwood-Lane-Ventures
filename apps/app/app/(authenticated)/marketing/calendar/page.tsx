import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { asMeta, getString, readPublishedAt } from '../lib/metadata';
import {
  MARKETING_ACTION_TYPES,
  MARKETING_TYPE_SHORT,
} from '../lib/marketing-types';

export const metadata: Metadata = {
  title: 'Calendar — Marketing — Bellwoods Lane',
  description: 'Month view of published marketing posts.',
};

export const dynamic = 'force-dynamic';

type Chip = { id: string; type: string; label: string };

const CalendarPage = async () => {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  // Only need completed marketing actions for the visible month.
  const today = new Date();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const completed = await database.founderAction.findMany({
    where: {
      type: { in: MARKETING_ACTION_TYPES },
      status: 'completed',
    },
    orderBy: { resolvedAt: 'desc' },
    take: 300, // generous cap — month has at most ~31 cells
  });

  // Bucket chips by ISO date (yyyy-MM-dd). Skip rows without publishedAt.
  const byDate = new Map<string, Chip[]>();
  for (const a of completed) {
    const meta = asMeta(a.metadata);
    const publishedAt = readPublishedAt(meta);
    if (!publishedAt) continue;
    if (publishedAt < gridStart || publishedAt > gridEnd) continue;

    const key = format(publishedAt, 'yyyy-MM-dd');
    const short = MARKETING_TYPE_SHORT[a.type] ?? 'Post';
    const tag =
      getString(meta, 'dealCode') ??
      getString(meta, 'topic') ??
      getString(meta, 'title') ??
      a.title.slice(0, 16);

    const chip: Chip = {
      id: a.id,
      type: a.type,
      label: `${short} · ${tag}`,
    };
    const list = byDate.get(key) ?? [];
    list.push(chip);
    byDate.set(key, list);
  }

  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const totalChips = [...byDate.values()].reduce((n, l) => n + l.length, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">{format(today, 'MMMM yyyy')}</h2>
          <p className="text-xs text-muted-foreground">
            {totalChips} published this month
          </p>
        </div>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div
            key={d}
            className="bg-slate-50 px-3 py-2 text-xs font-mono uppercase tracking-wide text-muted-foreground dark:bg-slate-900"
          >
            {d}
          </div>
        ))}
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const chips = byDate.get(key) ?? [];
          const otherMonth = !isSameMonth(day, today);
          return (
            <div
              key={key}
              className={`min-h-[100px] bg-card p-2 ${
                otherMonth ? 'opacity-40' : ''
              }`}
            >
              <div
                className={`mb-1 text-xs ${
                  isToday(day)
                    ? 'font-semibold text-foreground'
                    : 'text-muted-foreground'
                }`}
              >
                {format(day, 'd')}
              </div>
              <div className="space-y-1">
                {chips.slice(0, 4).map((c) => (
                  <div
                    key={c.id}
                    className="truncate rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                    title={c.label}
                  >
                    {c.label}
                  </div>
                ))}
                {chips.length > 4 && (
                  <div className="text-[10px] text-muted-foreground">
                    +{chips.length - 4} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {totalChips === 0 && (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center dark:border-slate-700 dark:bg-slate-900/30">
          <p className="text-sm font-medium">No publications yet this month.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Publication history will populate as you approve drafts in the
            Queue tab.
          </p>
        </div>
      )}
    </div>
  );
};

export default CalendarPage;
