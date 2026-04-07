'use client';

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@repo/design-system/components/ui/chart';
import { format, eachDayOfInterval, subDays, isSameDay } from 'date-fns';
import { BarChartIcon } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from 'recharts';
import { EmptyState } from '../components/empty-state';

type Entry = {
  mood: string | null;
  source: string;
  createdAt: Date;
};

type InsightsViewProps = {
  entries: Entry[];
};

const MOOD_MAP: Record<string, { label: string; score: number }> = {
  '🤩': { label: 'Amazing', score: 5 },
  '😊': { label: 'Good', score: 4 },
  '😐': { label: 'Okay', score: 3 },
  '😔': { label: 'Low', score: 2 },
  '😤': { label: 'Frustrated', score: 1 },
};

const MOOD_LABELS = ['', '😤', '😔', '😐', '😊', '🤩'];

const entryChartConfig = {
  entries: { label: 'Entries', color: 'hsl(var(--primary))' },
} satisfies ChartConfig;

const moodChartConfig = {
  mood: { label: 'Mood', color: 'hsl(var(--primary))' },
} satisfies ChartConfig;

const sourceChartConfig = {
  web: { label: 'Web', color: 'hsl(var(--primary))' },
  whatsapp: { label: 'WhatsApp', color: 'hsl(142 71% 45%)' },
} satisfies ChartConfig;

export const InsightsView = ({ entries }: InsightsViewProps) => {
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={BarChartIcon}
        title="No data yet"
        description="Write some entries to see your mood trends and activity."
        action={{ label: 'Start writing', href: '/' }}
      />
    );
  }

  const now = new Date();
  const thirtyDaysAgo = subDays(now, 29);
  const days = eachDayOfInterval({ start: thirtyDaysAgo, end: now });

  // Entry frequency per day
  const frequencyData = days.map((day) => {
    const dayEntries = entries.filter((e) =>
      isSameDay(new Date(e.createdAt), day)
    );
    return {
      date: format(day, 'MMM d'),
      entries: dayEntries.length,
    };
  });

  // Mood trend per day (average score)
  const moodData = days
    .map((day) => {
      const dayEntries = entries.filter(
        (e) => isSameDay(new Date(e.createdAt), day) && e.mood && MOOD_MAP[e.mood]
      );
      if (dayEntries.length === 0) return null;
      const avg =
        dayEntries.reduce((sum, e) => sum + (MOOD_MAP[e.mood!]?.score ?? 3), 0) /
        dayEntries.length;
      return {
        date: format(day, 'MMM d'),
        mood: Math.round(avg * 10) / 10,
      };
    })
    .filter(Boolean);

  // Mood distribution
  const moodCounts: Record<string, number> = {};
  for (const e of entries) {
    if (e.mood) {
      moodCounts[e.mood] = (moodCounts[e.mood] || 0) + 1;
    }
  }
  const moodDistribution = Object.entries(moodCounts)
    .sort((a, b) => (MOOD_MAP[b[0]]?.score ?? 0) - (MOOD_MAP[a[0]]?.score ?? 0))
    .map(([emoji, count]) => ({
      mood: `${emoji} ${MOOD_MAP[emoji]?.label ?? ''}`,
      count,
    }));

  // Source breakdown
  const webCount = entries.filter((e) => e.source === 'web').length;
  const waCount = entries.filter((e) => e.source === 'whatsapp').length;
  const sourceData = [
    { source: 'Web', count: webCount },
    { source: 'WhatsApp', count: waCount },
  ].filter((d) => d.count > 0);

  // Stats
  const totalEntries = entries.length;
  const activeDays = days.filter((day) =>
    entries.some((e) => isSameDay(new Date(e.createdAt), day))
  ).length;
  const avgPerDay = totalEntries / 30;

  return (
    <div className="flex flex-col gap-8">
      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-2xl font-bold">{totalEntries}</p>
          <p className="text-xs text-muted-foreground">Entries (30 days)</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-2xl font-bold">{activeDays}</p>
          <p className="text-xs text-muted-foreground">Active days</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-2xl font-bold">{avgPerDay.toFixed(1)}</p>
          <p className="text-xs text-muted-foreground">Avg per day</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-2xl font-bold">
            {Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'}
          </p>
          <p className="text-xs text-muted-foreground">Top mood</p>
        </div>
      </div>

      {/* Entry frequency chart */}
      <section>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Daily entries
        </h3>
        <div className="rounded-xl border bg-card p-4">
          <ChartContainer config={entryChartConfig} className="h-48 w-full">
            <BarChart data={frequencyData} accessibilityLayer>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                fontSize={11}
                interval="preserveStartEnd"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                fontSize={11}
                allowDecimals={false}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar
                dataKey="entries"
                fill="var(--color-entries)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        </div>
      </section>

      {/* Mood trend chart */}
      {moodData.length > 1 && (
        <section>
          <h3 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Mood trend
          </h3>
          <div className="rounded-xl border bg-card p-4">
            <ChartContainer config={moodChartConfig} className="h-48 w-full">
              <LineChart data={moodData} accessibilityLayer>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[1, 5]}
                  tickLine={false}
                  axisLine={false}
                  fontSize={13}
                  tickFormatter={(v: number) => MOOD_LABELS[v] ?? ''}
                  width={30}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => MOOD_LABELS[Math.round(value as number)] ?? value}
                    />
                  }
                />
                <Line
                  dataKey="mood"
                  type="monotone"
                  stroke="var(--color-mood)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ChartContainer>
          </div>
        </section>
      )}

      {/* Mood distribution + source breakdown side by side */}
      <div className="grid gap-6 lg:grid-cols-2">
        {moodDistribution.length > 0 && (
          <section>
            <h3 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Mood distribution
            </h3>
            <div className="rounded-xl border bg-card p-4">
              <ChartContainer config={entryChartConfig} className="h-48 w-full">
                <BarChart data={moodDistribution} layout="vertical" accessibilityLayer>
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} />
                  <YAxis type="category" dataKey="mood" tickLine={false} axisLine={false} fontSize={13} width={90} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="var(--color-entries)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            </div>
          </section>
        )}

        {sourceData.length > 1 && (
          <section>
            <h3 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Entry sources
            </h3>
            <div className="rounded-xl border bg-card p-4">
              <ChartContainer config={sourceChartConfig} className="h-48 w-full">
                <BarChart data={sourceData} accessibilityLayer>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="source" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="var(--color-web)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
