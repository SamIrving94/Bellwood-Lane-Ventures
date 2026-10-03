/**
 * Keyhole report builder. The implementation lives in @repo/kept-tools so the
 * Keyhole page and the ChatGPT plugin share one builder and one set of rules
 * (never a valuation; real data or nothing). See
 * packages/kept-tools/src/property-facts.ts.
 */

import 'server-only';

export {
  buildKeyholeReport,
  isSameAddress,
  type KeyholeRefurbBand,
  type KeyholeReportData,
  type KeyholeStreetSale,
} from '@repo/kept-tools/property-facts';
