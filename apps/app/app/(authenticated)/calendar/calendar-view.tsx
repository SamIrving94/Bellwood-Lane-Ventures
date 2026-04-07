'use client';

import { Calendar } from '@repo/design-system/components/ui/calendar';
import type { JournalEntry } from '@repo/database';
import { format, isSameDay } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '../components/empty-state';
import { EntryCard } from '../components/entry-card';

type CalendarViewProps = {
  entries: JournalEntry[];
};

export const CalendarView = ({ entries }: CalendarViewProps) => {
  const [selected, setSelected] = useState<Date | undefined>(new Date());
  const [displayEntries, setDisplayEntries] = useState<JournalEntry[]>(() =>
    entries.filter((e) => isSameDay(new Date(e.createdAt), new Date()))
  );

  // Build a set of dates that have entries (for highlighting)
  const entryDates = entries.map((e) => new Date(e.createdAt));

  const handleUpdated = (updated: JournalEntry) => {
    setDisplayEntries((prev) =>
      prev.map((e) => (e.id === updated.id ? updated : e))
    );
  };

  const handleSelect = (date: Date | undefined) => {
    setSelected(date);
    if (!date) {
      setDisplayEntries([]);
      return;
    }
    setDisplayEntries(
      entries.filter((e) => isSameDay(new Date(e.createdAt), date))
    );
  };

  const selectedLabel = selected
    ? format(selected, 'EEEE, MMMM d, yyyy')
    : 'Select a date';

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      {/* Calendar */}
      <div className="rounded-xl border bg-card p-1 lg:shrink-0">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={handleSelect}
          modifiers={{ hasEntry: entryDates }}
          modifiersClassNames={{
            hasEntry: 'font-bold underline decoration-primary decoration-2',
          }}
        />
      </div>

      {/* Entries for selected date */}
      <div className="flex flex-1 flex-col gap-3">
        <h3 className="text-sm font-medium text-muted-foreground">
          {selectedLabel}
        </h3>
        {displayEntries.length === 0 ? (
          <EmptyState
            icon={CalendarIcon}
            title="No entries on this day"
            description="Select a highlighted date to see your entries."
          />
        ) : (
          displayEntries.map((entry) => (
            <EntryCard key={entry.id} entry={entry} onUpdated={handleUpdated} />
          ))
        )}
      </div>
    </div>
  );
};
