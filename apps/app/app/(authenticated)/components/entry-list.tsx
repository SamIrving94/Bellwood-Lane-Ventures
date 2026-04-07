'use client';

import type { JournalEntry } from '@repo/database';
import { BookOpenIcon } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from './empty-state';
import { EntryCard } from './entry-card';

type EntryListProps = {
  initialEntries: JournalEntry[];
};

export const EntryList = ({ initialEntries }: EntryListProps) => {
  const [entries, setEntries] = useState(initialEntries);

  const handleDeleted = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const handleUpdated = (updated: JournalEntry) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === updated.id ? updated : e))
    );
  };

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={BookOpenIcon}
        title="No entries yet"
        description="Write your first journal entry above to get started."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {entries.map((entry) => (
        <EntryCard
          key={entry.id}
          entry={entry}
          onDeleted={handleDeleted}
          onUpdated={handleUpdated}
        />
      ))}
    </div>
  );
};
