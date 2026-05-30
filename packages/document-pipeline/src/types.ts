/**
 * @repo/document-pipeline — public types.
 *
 * `ProbateExtract` is the structured output of running a probate Grant PDF
 * through the OCR + Claude Citations pipeline. Every value field carries a
 * `Citation` so the founder can verify the claim against the source PDF.
 */

export interface Citation {
  /** Page index, 0-based. */
  pageIndex: number;
  /** Quoted source text supporting the value. Max 200 chars. */
  excerpt: string;
}

export type GrantType = 'probate' | 'letters_of_administration' | 'unknown';

export interface CitedValue<T> {
  value: T;
  citation: Citation;
}

export interface CitedExecutor {
  name: string;
  address?: string;
  citation: Citation;
}

export interface CitedPropertyAddress {
  address: string;
  postcode?: string;
  citation: Citation;
}

export interface ProbateExtract {
  deceasedName: CitedValue<string> | null;
  /** ISO date string (YYYY-MM-DD) when available. */
  dateOfDeath: CitedValue<string> | null;
  /** ISO date string (YYYY-MM-DD) when available. */
  dateOfGrant: CitedValue<string> | null;
  grantType: GrantType;
  executors: CitedExecutor[];
  solicitorFirm: CitedValue<string> | null;
  totalEstateGrossPence: CitedValue<number> | null;
  totalEstateNetPence: CitedValue<number> | null;
  propertyAddresses: CitedPropertyAddress[];
  ihtPaidIndicator: CitedValue<boolean> | null;
  /** 0..1. 0 means we returned nothing useful. */
  confidence: number;
  /** Set when something failed catastrophically. */
  errorReason?: string;
}

/**
 * Empty extract — every value null, confidence 0. Used as a graceful-fallback
 * return when the pipeline cannot proceed (e.g. missing API keys, bad PDF).
 */
export function emptyProbateExtract(errorReason?: string): ProbateExtract {
  return {
    deceasedName: null,
    dateOfDeath: null,
    dateOfGrant: null,
    grantType: 'unknown',
    executors: [],
    solicitorFirm: null,
    totalEstateGrossPence: null,
    totalEstateNetPence: null,
    propertyAddresses: [],
    ihtPaidIndicator: null,
    confidence: 0,
    ...(errorReason ? { errorReason } : {}),
  };
}
