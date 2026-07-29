/**
 * Feedback-insight vocabulary + normalisation — the PURE half of the
 * insight pipeline (no server-only / LLM imports), shared by the extraction
 * module, the calibration page, and unit tests.
 *
 * Themes are a FIXED vocabulary so signals aggregate: "garden's a mess",
 * "no outside space" and "lovely big lawn" all land on `garden` and can be
 * counted against each other across months of feedback.
 */

/** Canonical property-preference themes. Keep in sync with THEME_LABELS. */
export const INSIGHT_THEMES = [
  'location',
  'street_scene',
  'condition',
  'refurb_cost',
  'structural',
  'damp',
  'layout',
  'size',
  'kitchen',
  'bathroom',
  'garden',
  'parking',
  'kerb_appeal',
  'extension_potential',
  'price',
  'value',
  'yield',
  'resale_potential',
  'tenure_lease',
  'epc_energy',
  'schools',
  'transport',
  'flood_risk',
  'neighbours',
  'hmo_potential',
  'vendor_motivation',
] as const;

export type InsightTheme = (typeof INSIGHT_THEMES)[number];

/** Human labels for the dashboard. */
export const THEME_LABELS: Record<InsightTheme, string> = {
  location: 'Location',
  street_scene: 'Street scene',
  condition: 'Condition',
  refurb_cost: 'Refurb cost',
  structural: 'Structural',
  damp: 'Damp',
  layout: 'Layout',
  size: 'Size',
  kitchen: 'Kitchen',
  bathroom: 'Bathroom',
  garden: 'Garden / outside space',
  parking: 'Parking',
  kerb_appeal: 'Kerb appeal',
  extension_potential: 'Extension potential',
  price: 'Price',
  value: 'Value for money',
  yield: 'Yield',
  resale_potential: 'Resale potential',
  tenure_lease: 'Tenure / lease',
  epc_energy: 'EPC / energy',
  schools: 'Schools',
  transport: 'Transport links',
  flood_risk: 'Flood risk',
  neighbours: 'Neighbours',
  hmo_potential: 'HMO potential',
  vendor_motivation: 'Vendor motivation',
};

export type ThemeSignal = {
  theme: InsightTheme;
  /** Short phrase from the note supporting the signal. */
  quote: string;
};

export type FeedbackInsights = {
  sentiment: 'positive' | 'negative' | 'mixed' | 'neutral';
  likes: ThemeSignal[];
  dislikes: ThemeSignal[];
  /** Hard NOs — "never buy on this road", "won't touch short leases". */
  dealbreakers: string[];
  /** One-line summary of the note in plain English. */
  summary: string;
  extractedAt: string;
  model: string;
};

const THEME_SET = new Set<string>(INSIGHT_THEMES);

/**
 * Validate + normalise a raw LLM payload into FeedbackInsights. Unknown
 * themes are dropped; quotes clamped; returns null when nothing usable
 * survives — a null insight is never stored.
 */
export function normaliseInsights(
  raw: unknown,
  meta: { extractedAt: string; model: string }
): FeedbackInsights | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const readSignals = (value: unknown): ThemeSignal[] => {
    if (!Array.isArray(value)) return [];
    const out: ThemeSignal[] = [];
    for (const item of value) {
      if (!item || typeof item !== 'object') continue;
      const { theme, quote } = item as Record<string, unknown>;
      if (typeof theme !== 'string' || !THEME_SET.has(theme)) continue;
      out.push({
        theme: theme as InsightTheme,
        quote: typeof quote === 'string' ? quote.slice(0, 160) : '',
      });
    }
    return out;
  };

  const likes = readSignals(r.likes);
  const dislikes = readSignals(r.dislikes);
  const dealbreakers = Array.isArray(r.dealbreakers)
    ? r.dealbreakers
        .filter((d): d is string => typeof d === 'string' && d.trim() !== '')
        .map((d) => d.slice(0, 200))
    : [];

  const sentiment =
    r.sentiment === 'positive' ||
    r.sentiment === 'negative' ||
    r.sentiment === 'mixed' ||
    r.sentiment === 'neutral'
      ? r.sentiment
      : 'neutral';

  const summary = typeof r.summary === 'string' ? r.summary.slice(0, 300) : '';

  if (likes.length === 0 && dislikes.length === 0 && dealbreakers.length === 0) {
    return null;
  }

  return {
    sentiment,
    likes,
    dislikes,
    dealbreakers,
    summary,
    extractedAt: meta.extractedAt,
    model: meta.model,
  };
}
