/**
 * Credit usage logging — single source of truth so we can watch PropertyData
 * spend per process. Each endpoint declares its estimated credit cost; cache
 * hits cost zero.
 */

let creditsThisProcess = 0;

export function getProcessCredits() {
  return creditsThisProcess;
}

export function logCreditUsage(
  endpoint: string,
  credits: number,
  fromCache: boolean,
) {
  if (fromCache) {
    console.info(`[propertydata] ${endpoint} cache hit — 0 credits`);
    return;
  }
  creditsThisProcess += credits;
  console.info(
    `[propertydata] ${endpoint} +${credits} credits (process total: ${creditsThisProcess})`,
  );
}
