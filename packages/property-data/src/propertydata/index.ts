/**
 * PropertyData REST API client — public surface.
 *
 * This barrel preserves the exact module that used to live in
 * `src/propertydata.ts`. Consumers import it either via the package root
 * (`@repo/property-data`) or the deep path (`@repo/property-data/src/propertydata`,
 * which now resolves to this directory). Internals (fetch client, cache, credit
 * accounting) live in sibling files and are intentionally NOT re-exported.
 */

import 'server-only';

export { getProcessCredits } from './credits';

export * from './endpoints/valuation';
export * from './endpoints/market';
export * from './endpoints/sourced';
export * from './endpoints/epc-tenure';
export * from './endpoints/listings';
export * from './endpoints/preflight';
export * from './endpoints/account';
export * from './endpoints/planning';
export * from './endpoints/market-stats';
export * from './endpoints/snapshot';
export * from './endpoints/george';
