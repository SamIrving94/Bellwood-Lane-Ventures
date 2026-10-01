/** Money is pence integers everywhere (CLAUDE.md "Money"). */

export function poundsToPence(pounds: number): number {
  return Math.round(pounds * 100);
}

/** "£12,345" — whole pounds, en-GB grouping, minus sign for negatives. */
export function formatPounds(pence: number): string {
  const pounds = Math.round(pence / 100);
  const abs = Math.abs(pounds).toLocaleString('en-GB');
  return pounds < 0 ? `-£${abs}` : `£${abs}`;
}
