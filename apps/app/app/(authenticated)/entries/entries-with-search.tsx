'use client';

import { Button } from '@repo/design-system/components/ui/button';
import type { JournalEntry } from '@repo/database';
import { DownloadIcon } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { EntryList } from '../components/entry-list';
import { SearchBar } from '../components/search-bar';
import { listEntries } from '../../actions/entries/list';

const PAGE_SIZE = 25;

type EntriesWithSearchProps = {
  initialEntries: JournalEntry[];
  totalCount: number;
};

export const EntriesWithSearch = ({ initialEntries, totalCount }: EntriesWithSearchProps) => {
  const [results, setResults] = useState(initialEntries);
  const [isSearching, setIsSearching] = useState(false);
  const [hasMore, setHasMore] = useState(initialEntries.length < totalCount);
  const [isLoadingMore, startLoadMore] = useTransition();

  const handleSearchResults = (entries: JournalEntry[]) => {
    setResults(entries);
    setIsSearching(entries !== initialEntries);
    setHasMore(false); // Disable load more during search
  };

  const handleLoadMore = () => {
    startLoadMore(async () => {
      const result = await listEntries(PAGE_SIZE, results.length);
      if ('data' in result) {
        const newResults = [...results, ...result.data];
        setResults(newResults);
        setHasMore(result.data.length === PAGE_SIZE);
      }
    });
  };

  const handleExport = async () => {
    try {
      const res = await fetch('/api/export');
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `microjournal-export-${new Date().toISOString().split('T')[0]}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Journal exported');
    } catch {
      toast.error('Export failed');
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <SearchBar onResults={handleSearchResults} allEntries={initialEntries} />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          title="Export as PDF"
        >
          <DownloadIcon className="mr-1.5 h-4 w-4" />
          Export
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {results.length === 0
          ? 'No entries found.'
          : `${results.length} entr${results.length === 1 ? 'y' : 'ies'}${!isSearching && totalCount > results.length ? ` of ${totalCount}` : ''}`}
      </p>
      <EntryList initialEntries={results} />
      {hasMore && !isSearching && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
    </>
  );
};
