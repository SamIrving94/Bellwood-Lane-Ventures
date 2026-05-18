'use client';

import { useEffect, useRef, useState } from 'react';
import { searchAreaSuggestions, type Suggestion } from './areas-actions';

type Props = {
  value: string;
  onChange: (v: string) => void;
  onPick: (s: Suggestion) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
};

export function AreaTypeahead({
  value,
  onChange,
  onPick,
  onSubmit,
  disabled,
  placeholder,
}: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced lookup
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim() || value.trim().length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchAreaSuggestions(value);
        setSuggestions(results);
        setActiveIdx(-1);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  // Click outside closes
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) {
      if (e.key === 'Enter') {
        e.preventDefault();
        onSubmit();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(suggestions.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(-1, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && suggestions[activeIdx]) {
        onPick(suggestions[activeIdx]);
        setOpen(false);
      } else {
        onSubmit();
        setOpen(false);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative flex-1">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKey}
        placeholder={placeholder ?? 'e.g. Manchester · M14 · SK4 4QR'}
        disabled={disabled}
        autoComplete="off"
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-[15px] outline-none focus:border-amber-400 disabled:opacity-50"
      />

      {open && (suggestions.length > 0 || loading) && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          {loading && suggestions.length === 0 && (
            <p className="px-4 py-3 text-xs text-muted-foreground">
              Searching…
            </p>
          )}
          {suggestions.map((s, i) => (
            <button
              key={`${s.district}-${i}`}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onPick(s);
                setOpen(false);
              }}
              onMouseEnter={() => setActiveIdx(i)}
              className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition ${
                i === activeIdx ? 'bg-amber-50' : 'hover:bg-slate-50'
              }`}
            >
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium text-slate-900">{s.label}</span>
                <span className="ml-2 font-mono text-[11px] text-slate-500">
                  {s.district} · seed {s.seedPostcode}
                </span>
              </span>
              {s.source === 'builtin' && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-600">
                  popular
                </span>
              )}
            </button>
          ))}
          {!loading && suggestions.length === 0 && value.trim().length >= 2 && (
            <p className="px-4 py-3 text-xs text-muted-foreground">
              No suggestions. Try a full postcode like &ldquo;M14 5LL&rdquo;.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
