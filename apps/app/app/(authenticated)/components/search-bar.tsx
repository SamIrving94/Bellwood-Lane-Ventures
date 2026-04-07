'use client';

import { Input } from '@repo/design-system/components/ui/input';
import type { JournalEntry } from '@repo/database';
import { SearchIcon, XIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { searchEntries } from '../../actions/entries/search';

type SearchBarProps = {
  onResults: (entries: JournalEntry[]) => void;
  allEntries: JournalEntry[];
};

export const SearchBar = ({ onResults, allEntries }: SearchBarProps) => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        onResults(allEntries);
        return;
      }
      setIsSearching(true);
      const result = await searchEntries(q);
      if ('data' in result) {
        onResults(result.data);
      }
      setIsSearching(false);
    },
    [allEntries, onResults]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  const clear = () => {
    setQuery('');
    onResults(allEntries);
  };

  return (
    <div className="relative">
      <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={isSearching ? 'Searching…' : 'Search entries…'}
        className="pl-9 pr-9"
      />
      {query && (
        <button
          onClick={clear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label="Clear search"
          type="button"
        >
          <XIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};
