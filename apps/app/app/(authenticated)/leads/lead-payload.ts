/**
 * lead-payload.ts — ScoutLead → LeadView presenter (BELA-116)
 *
 * Intent
 * ------
 * The Pipeline → Leads tab was "too blank": founders could not triage a lead
 * without opening it. Most of the triage-relevant data Scout pushes (asking
 * price, source/listing URL, motivation cause, auction date, tenure, beds…)
 * does not live in typed ScoutLead columns — it lands in the free-form
 * `rawPayload` JSON, whose exact key names are decided by the pushing agent
 * (see apps/api/app/agents/leads/route.ts — `rawPayload: z.record(...)`).
 *
 * This module normalises a ScoutLead (typed columns + `rawPayload`) into a
 * flat, serialisable {@link LeadView} the UI can render directly.
 *
 * Design rules
 * ------------
 * - **Tolerant input.** `rawPayload` is `unknown`; key names vary. Every field
 *   is looked up against an alias list (camelCase / snake_case / unit variants)
 *   and degrades to `null` rather than throwing.
 * - **Authoritative columns win.** Where a typed column exists (e.g.
 *   `estimatedEquityPence`) it is preferred over `rawPayload`.
 * - **Currency is normalised to pence.** Keys ending in `Pence` are trusted as
 *   pence; bare money keys are treated as pounds (×100). A guard treats
 *   implausibly large "pound" values as already-pence so we never render £100m.
 * - **Pure & framework-free** so it is unit-testable and can run in a Server
 *   Component, then hand a plain object to the client table.
 *
 * Failure modes
 * -------------
 * - Unknown/garbled `rawPayload` → all derived fields `null`, summary falls back
 *   to `sourceTrail` then a leadType-derived sentence. The lead still renders.
 * - Unrecognised key name for a real value → that value shows as `—`; the lead
 *   detail page additionally dumps the full raw payload so nothing is hidden.
 */

export type EnrichmentState = 'pending' | 'enriched';

export type FlagTone = 'danger' | 'warn' | 'info';

export interface LeadFlag {
  kind: 'auction' | 'gate' | 'lease' | 'cash' | 'vacant' | 'note';
  label: string;
  tone: FlagTone;
}

/** Minimal slice of a ScoutLead row this presenter needs. */
export interface LeadInput {
  id: string;
  address: string;
  postcode: string;
  leadType: string;
  leadScore: number;
  verdict: string;
  status: string;
  source: string;
  sourceTrail: string | null;
  marketTrend: string | null;
  estimatedEquityPence: number | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  rawPayload: unknown;
  existingRating?: number;
}

export interface LeadView {
  id: string;
  address: string;
  postcode: string;
  leadType: string;
  leadTypeLabel: string;
  leadScore: number;
  verdict: string;
  status: string;

  // The numbers (all pence)
  askingPricePence: number | null;
  estimatePence: number | null;
  headroomPence: number | null;
  headroomPct: number | null;

  // Why-it-matters
  relevanceSummary: string;

  // Source
  sourceUrl: string | null;
  sourceLabel: string;
  sourceName: string;

  // Property basics
  propertyType: string | null;
  tenure: 'freehold' | 'leasehold' | null;
  tenureLabel: string | null;
  bedrooms: number | null;
  leaseYears: number | null;

  // Flags / caveats
  flags: LeadFlag[];

  // Score + enrichment state
  enrichmentState: EnrichmentState;
  marketTrend: string | null;

  existingRating: number;
}

// ---------------------------------------------------------------------------
// Regex literals (hoisted to module scope per lint/performance/useTopLevelRegex)
// ---------------------------------------------------------------------------

const RE_MONEY_STRIP = /[£,\s]/gi;
const RE_THOUSANDS_K = /^(\d+(?:\.\d+)?)k$/i;
const RE_TRUTHY = /^(true|yes|y|1)$/i;
const RE_WHITESPACE = /\s+/g;
const RE_UNDERSCORE = /_/g;
const RE_WORD_START = /\b\w/g;
const RE_URL_PROTOCOL = /^https?:\/\//i;
const RE_WWW_PREFIX = /^www\./;
const RE_ISO_DATE = /^\d{4}-\d{2}-\d{2}/;
const RE_DMY_DATE = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/;

// ---------------------------------------------------------------------------
// Tolerant rawPayload accessors
// ---------------------------------------------------------------------------

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function pickString(
  rec: Record<string, unknown>,
  keys: string[]
): string | null {
  for (const key of keys) {
    const v = rec[key];
    if (typeof v === 'string' && v.trim()) {
      return v.trim();
    }
    if (typeof v === 'number' && Number.isFinite(v)) {
      return String(v);
    }
  }
  return null;
}

function pickNumber(
  rec: Record<string, unknown>,
  keys: string[]
): number | null {
  for (const key of keys) {
    const v = rec[key];
    if (typeof v === 'number' && Number.isFinite(v)) {
      return v;
    }
    if (typeof v === 'string') {
      // Accept "£85,000", "85000", "140k"
      const cleaned = v.replace(RE_MONEY_STRIP, '');
      const kMatch = RE_THOUSANDS_K.exec(cleaned);
      if (kMatch) {
        return Number.parseFloat(kMatch[1]) * 1000;
      }
      const n = Number.parseFloat(cleaned);
      if (Number.isFinite(n)) {
        return n;
      }
    }
  }
  return null;
}

function pickBool(rec: Record<string, unknown>, keys: string[]): boolean {
  for (const key of keys) {
    const v = rec[key];
    if (v === true) {
      return true;
    }
    if (typeof v === 'string' && RE_TRUTHY.test(v.trim())) {
      return true;
    }
    if (typeof v === 'number' && v === 1) {
      return true;
    }
  }
  return false;
}

/**
 * Resolve a money value to pence.
 * - `penceKeys` are trusted verbatim as pence.
 * - `poundKeys` are treated as pounds (×100), unless the value is implausibly
 *   large for pounds (≥ £10m) in which case it is assumed to already be pence.
 */
function moneyToPence(
  rec: Record<string, unknown>,
  penceKeys: string[],
  poundKeys: string[]
): number | null {
  const pence = pickNumber(rec, penceKeys);
  if (pence != null) {
    return Math.round(pence);
  }
  const pounds = pickNumber(rec, poundKeys);
  if (pounds == null) {
    return null;
  }
  if (pounds >= 10_000_000) {
    return Math.round(pounds); // already pence
  }
  return Math.round(pounds * 100);
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

const LEAD_TYPE_LABELS: Record<string, string> = {
  probate: 'Probate',
  probate_admin: 'Probate (admin)',
  chain_break: 'Chain-break',
  repossession: 'Repossession',
  short_lease: 'Short lease',
  lease_expiry: 'Short lease',
  auction: 'Auction',
  distressed_sale: 'Distressed sale',
  divorce: 'Divorce',
  empty_property: 'Vacant property',
  downsizing: 'Downsizing',
  relocation: 'Relocation',
  unknown: 'Uncategorised',
  standard: 'Uncategorised',
};

export function leadTypeLabel(leadType: string): string {
  const key = leadType.toLowerCase().replace(RE_WHITESPACE, '_');
  return (
    LEAD_TYPE_LABELS[key] ??
    leadType
      .replace(RE_UNDERSCORE, ' ')
      .replace(RE_WORD_START, (c) => c.toUpperCase())
  );
}

const LEAD_TYPE_WHY: Record<string, string> = {
  probate:
    'Probate sale — estate being wound up; executors are often motivated to sell quickly and below market.',
  probate_admin:
    'Probate (letters of administration) — unplanned estate, typically a motivated, time-pressured sale.',
  chain_break:
    'Chain-break — the onward purchase collapsed; the vendor needs a fast, certain buyer.',
  repossession:
    'Repossession / receiver sale — lender-driven disposal, usually priced for a quick sale.',
  short_lease:
    'Short lease — a diminishing term suppresses the price; equity play on a lease extension.',
  lease_expiry:
    'Short lease — a diminishing term suppresses the price; equity play on a lease extension.',
  auction:
    'Auction lot — time-bound disposal with completion certainty; scope for BMV.',
};

// ---------------------------------------------------------------------------
// Field extractors
// ---------------------------------------------------------------------------

function extractSourceUrl(rec: Record<string, unknown>): string | null {
  const raw = pickString(rec, [
    'sourceUrl',
    'source_url',
    'listingUrl',
    'listing_url',
    'url',
    'link',
    'sourceLink',
    'rightmoveUrl',
    'zooplaUrl',
    'listing',
    'href',
  ]);
  if (!raw) {
    return null;
  }
  if (!RE_URL_PROTOCOL.test(raw)) {
    return null;
  }
  return raw;
}

function sourceLabelFromUrl(url: string | null, fallback: string): string {
  if (!url) {
    return fallback;
  }
  try {
    const host = new URL(url).hostname.replace(RE_WWW_PREFIX, '').toLowerCase();
    if (host.includes('rightmove')) {
      return 'Rightmove';
    }
    if (host.includes('zoopla')) {
      return 'Zoopla';
    }
    if (host.includes('onthemarket')) {
      return 'OnTheMarket';
    }
    if (host.includes('savills')) {
      return 'Savills';
    }
    if (host.includes('auction')) {
      return 'Auction listing';
    }
    if (host.includes('gov.uk')) {
      return 'GOV.UK';
    }
    return host;
  } catch {
    return fallback;
  }
}

function extractTenure(
  rec: Record<string, unknown>,
  leaseYears: number | null
): { tenure: 'freehold' | 'leasehold' | null; label: string | null } {
  const raw = pickString(rec, [
    'tenure',
    'leaseType',
    'lease_type',
    'ownership',
  ]);
  let tenure: 'freehold' | 'leasehold' | null = null;
  if (raw) {
    const t = raw.toLowerCase();
    if (t.includes('free') || t === 'fh') {
      tenure = 'freehold';
    } else if (t.includes('lease') || t === 'lh') {
      tenure = 'leasehold';
    }
  }
  // A stated lease length implies leasehold even if tenure was omitted.
  if (!tenure && leaseYears != null) {
    tenure = 'leasehold';
  }

  if (tenure === 'freehold') {
    return { tenure, label: 'Freehold' };
  }
  if (tenure === 'leasehold') {
    return {
      tenure,
      label: leaseYears != null ? `Leasehold · ${leaseYears} yr` : 'Leasehold',
    };
  }
  return { tenure: null, label: null };
}

function buildRelevanceSummary(
  lead: LeadInput,
  rec: Record<string, unknown>
): string {
  const explicit = pickString(rec, [
    'relevanceSummary',
    'relevance',
    'why',
    'whyThisIsALead',
    'summary',
    'leadSignal',
    'signal',
    'cause',
    'motivation',
    'reason',
    'narrative',
    'notes',
    'note',
    'description',
  ]);
  if (explicit) {
    return explicit;
  }

  if (lead.sourceTrail?.trim()) {
    return lead.sourceTrail.trim();
  }

  const key = lead.leadType.toLowerCase().replace(RE_WHITESPACE, '_');
  return (
    LEAD_TYPE_WHY[key] ??
    'Disposal signal detected — open the lead to review the motivation and source.'
  );
}

/**
 * Parse a date that may be ISO, dd/mm/yyyy or dd/mm (year-less). Returns null
 * for ranges / unparseable strings — the caller still surfaces the raw text.
 */
function parseLooseDate(value: string, now: Date): Date | null {
  const iso = RE_ISO_DATE.exec(value);
  if (iso) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  // dd/mm/yyyy or dd/mm  (reject ranges like "16-17/06")
  const dmy = RE_DMY_DATE.exec(value.trim());
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]) - 1;
    let year = dmy[3] ? Number(dmy[3]) : now.getFullYear();
    if (year < 100) {
      year += 2000;
    }
    const d = new Date(year, month, day);
    if (Number.isNaN(d.getTime())) {
      return null;
    }
    // Year-less date already passed this year → assume next year.
    if (!dmy[3] && d.getTime() < now.getTime() - 86_400_000) {
      d.setFullYear(year + 1);
    }
    return d;
  }
  return null;
}

function formatDateGB(d: Date): string {
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

const SHORT_LEASE_THRESHOLD_YEARS = 80; // marriage-value / lender-risk threshold

/** Auction date + T-7 lead-time gate (our discipline floor for live bidding). */
function auctionFlag(rec: Record<string, unknown>, now: Date): LeadFlag | null {
  const raw = pickString(rec, [
    'auctionDate',
    'auction_date',
    'auction',
    'auctionDateISO',
    'saleDate',
  ]);
  if (!raw) {
    return null;
  }
  const parsed = parseLooseDate(raw, now);
  if (!parsed) {
    return {
      kind: 'auction',
      label: `Auction ${raw} — verify T-7 lead time`,
      tone: 'warn',
    };
  }
  const days = Math.ceil((parsed.getTime() - now.getTime()) / 86_400_000);
  if (days < 7) {
    return {
      kind: 'gate',
      label: `Auction ${formatDateGB(parsed)} · T-7 gate (${days <= 0 ? 'passed' : `${days}d`}) — watchlist only`,
      tone: 'danger',
    };
  }
  return {
    kind: 'auction',
    label: `Auction ${formatDateGB(parsed)} (${days}d)`,
    tone: 'warn',
  };
}

/** Short-lease risk (marriage value / lending), or an unconfirmed-lease nudge. */
function leaseFlag(
  rec: Record<string, unknown>,
  leaseYears: number | null
): LeadFlag | null {
  if (leaseYears != null && leaseYears < SHORT_LEASE_THRESHOLD_YEARS) {
    return {
      kind: 'lease',
      label: `Short lease · ${leaseYears} yr — extension cost / lending risk`,
      tone: 'danger',
    };
  }
  if (pickBool(rec, ['leaseLengthUnknown', 'leaseUnconfirmed'])) {
    return {
      kind: 'lease',
      label: 'Lease length unconfirmed — verify before offer',
      tone: 'warn',
    };
  }
  return null;
}

/** Free-form caveats Scout may attach as `flags` / `caveats` string arrays. */
function caveatFlags(rec: Record<string, unknown>): LeadFlag[] {
  const extra = rec.flags ?? rec.caveats;
  if (!Array.isArray(extra)) {
    return [];
  }
  return extra
    .filter(
      (item): item is string => typeof item === 'string' && item.trim() !== ''
    )
    .map((item) => ({ kind: 'note', label: item.trim(), tone: 'info' }));
}

function buildFlags(
  rec: Record<string, unknown>,
  leaseYears: number | null,
  now: Date
): LeadFlag[] {
  const flags: LeadFlag[] = [];

  const auction = auctionFlag(rec, now);
  if (auction) {
    flags.push(auction);
  }

  const lease = leaseFlag(rec, leaseYears);
  if (lease) {
    flags.push(lease);
  }

  if (pickBool(rec, ['cashBuyersOnly', 'cashOnly', 'cashBuyerOnly'])) {
    flags.push({ kind: 'cash', label: 'Cash buyers only', tone: 'info' });
  }

  if (pickBool(rec, ['vacant', 'vacantPossession', 'isVacant'])) {
    flags.push({ kind: 'vacant', label: 'Vacant possession', tone: 'info' });
  }

  flags.push(...caveatFlags(rec));

  return flags;
}

function deriveEnrichmentState(
  lead: LeadInput,
  rec: Record<string, unknown>
): EnrichmentState {
  const explicit = pickNumber(rec, ['contactQuality', 'contact_quality']);
  if (explicit != null) {
    return explicit > 0 ? 'enriched' : 'pending';
  }
  const hasContact = Boolean(
    lead.contactName || lead.contactPhone || lead.contactEmail
  );
  return hasContact ? 'enriched' : 'pending';
}

// ---------------------------------------------------------------------------
// Public presenter
// ---------------------------------------------------------------------------

export function presentLead(lead: LeadInput, opts?: { now?: Date }): LeadView {
  const now = opts?.now ?? new Date();
  const rec = asRecord(lead.rawPayload);

  const askingPricePence = moneyToPence(
    rec,
    ['askingPricePence', 'asking_price_pence', 'guidePricePence'],
    [
      'askingPrice',
      'asking_price',
      'asking',
      'guidePrice',
      'guide_price',
      'price',
      'listPrice',
      'listingPrice',
    ]
  );

  // Estimate: authoritative column first, then rawPayload variants.
  const estimatePence =
    lead.estimatedEquityPence ??
    moneyToPence(
      rec,
      [
        'estimatePence',
        'estimatedValuePence',
        'prelimEstimatePence',
        'estimatedMarketValuePence',
      ],
      [
        'estimate',
        'estimatedValue',
        'prelimEstimate',
        'prelimEst',
        'estimatedMarketValue',
        'gdv',
      ]
    );

  let headroomPence: number | null = null;
  let headroomPct: number | null = null;
  if (
    askingPricePence != null &&
    estimatePence != null &&
    askingPricePence > 0
  ) {
    headroomPence = estimatePence - askingPricePence;
    headroomPct = Math.round((headroomPence / askingPricePence) * 1000) / 10;
  }

  const leaseYears = pickNumber(rec, [
    'leaseYears',
    'leaseYearsRemaining',
    'leaseLength',
    'lease_years',
    'leaseRemaining',
  ]);
  const { tenure, label: tenureLabel } = extractTenure(rec, leaseYears);

  const sourceUrl = extractSourceUrl(rec);

  return {
    id: lead.id,
    address: lead.address,
    postcode: lead.postcode,
    leadType: lead.leadType,
    leadTypeLabel: leadTypeLabel(lead.leadType),
    leadScore: lead.leadScore,
    verdict: lead.verdict,
    status: lead.status,

    askingPricePence,
    estimatePence,
    headroomPence,
    headroomPct,

    relevanceSummary: buildRelevanceSummary(lead, rec),

    sourceUrl,
    sourceLabel: sourceLabelFromUrl(sourceUrl, lead.source || 'Source'),
    sourceName: lead.source,

    propertyType: pickString(rec, [
      'propertyType',
      'property_type',
      'type',
      'propertyStyle',
      'style',
    ]),
    tenure,
    tenureLabel,
    bedrooms: pickNumber(rec, [
      'bedrooms',
      'beds',
      'bedroomCount',
      'numberOfBedrooms',
    ]),
    leaseYears,

    flags: buildFlags(rec, leaseYears, now),

    enrichmentState: deriveEnrichmentState(lead, rec),
    marketTrend: lead.marketTrend,

    existingRating: lead.existingRating ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Formatting helpers (shared by table + detail)
// ---------------------------------------------------------------------------

const gbpFormatter = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
});

/** Format a pence amount as GBP, e.g. 8500000 → "£85,000". */
export function formatGBPFromPence(pence: number | null | undefined): string {
  if (pence == null || !Number.isFinite(pence)) {
    return '—';
  }
  return gbpFormatter.format(Math.round(pence) / 100);
}

/** Compact GBP for tight cells, e.g. 14000000 → "£140k", 1200000000 → "£1.2m". */
export function formatGBPCompact(pence: number | null | undefined): string {
  if (pence == null || !Number.isFinite(pence)) {
    return '—';
  }
  const pounds = Math.round(pence) / 100;
  const abs = Math.abs(pounds);
  const sign = pounds < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    return `${sign}£${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}m`;
  }
  if (abs >= 1_000) {
    return `${sign}£${Math.round(abs / 1_000)}k`;
  }
  return `${sign}£${Math.round(abs)}`;
}

/** Format headroom percentage with sign, e.g. 64.7 → "+64.7%". */
export function formatHeadroomPct(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) {
    return '—';
  }
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct}%`;
}
