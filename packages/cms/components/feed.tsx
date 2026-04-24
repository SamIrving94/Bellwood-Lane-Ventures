// Stubbed: upstream basehub package changed its API (removed Pump export).
// Returns a passthrough render-prop component so existing call sites keep
// compiling. Wire up a real CMS pump later if basehub is needed.

// biome-ignore lint/suspicious/noExplicitAny: stub for upstream API drift
type FeedProps = {
  queries?: unknown[];
  children?: any;
};

export function Feed({ children }: FeedProps) {
  // Caller passes a function child; call it with empty data.
  if (typeof children === 'function') {
    // biome-ignore lint/suspicious/noExplicitAny: stub shape
    const empty: any[] = [];
    return children(empty);
  }
  return children ?? null;
}
