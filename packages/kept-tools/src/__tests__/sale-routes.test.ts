import { describe, expect, it } from 'vitest';
import { compareSaleRoutes } from '../sale-routes';

const route = (r: ReturnType<typeof compareSaleRoutes>, key: string) => {
  const found = r.routes.find((x) => x.route === key);
  if (!found) throw new Error(`no route ${key}`);
  return found;
};

describe('compareSaleRoutes', () => {
  it('returns the three routes in a fixed order, never ranked', () => {
    const r = compareSaleRoutes({ expectedPricePence: 250_000_00 });
    expect(r.routes.map((x) => x.route)).toEqual([
      'estate_agent',
      'auction',
      'cash_buyer',
    ]);
  });

  it('charges the default agent fee plus VAT on the user figure', () => {
    const r = compareSaleRoutes({ expectedPricePence: 200_000_00 });
    const agent = route(r, 'estate_agent');
    // 1.25% of £200,000 = £2,500; + 20% VAT = £3,000
    expect(agent.costs[0]?.pence).toBe(3_000_00);
    expect(agent.netPence).toBe(197_000_00);
    expect(agent.assumptions.join(' ')).toMatch(/assumed at 1.25%/);
  });

  it('never invents a cash figure: the cash row is blank without an offer', () => {
    const r = compareSaleRoutes({ expectedPricePence: 200_000_00 });
    const cash = route(r, 'cash_buyer');
    expect(cash.pricePence).toBeNull();
    expect(cash.netPence).toBeNull();
    expect(r.missing.join(' ')).toMatch(/cash offer/);
  });

  it('uses the cash offer the user holds', () => {
    const r = compareSaleRoutes({
      expectedPricePence: 250_000_00,
      cashOfferPence: 210_000_00,
      legalFeesPence: 1_200_00,
    });
    const cash = route(r, 'cash_buyer');
    expect(cash.pricePence).toBe(210_000_00);
    expect(cash.netPence).toBe(210_000_00 - 1_200_00);
  });

  it('adds holding costs per route from the months to complete', () => {
    const r = compareSaleRoutes({
      expectedPricePence: 200_000_00,
      monthlyHoldingCostPence: 300_00,
    });
    expect(route(r, 'estate_agent').costs.at(-1)).toEqual({
      label: 'Holding costs, 5 months',
      pence: 1_500_00,
    });
    expect(route(r, 'auction').costs.at(-1)?.pence).toBe(600_00);
  });

  it('honours user overrides and drops the matching assumptions', () => {
    const r = compareSaleRoutes({
      expectedPricePence: 200_000_00,
      agentFeePercent: 1,
      monthsToComplete: { estate_agent: 3 },
    });
    const agent = route(r, 'estate_agent');
    expect(agent.costs[0]?.pence).toBe(2_400_00);
    expect(agent.monthsToComplete).toBe(3);
    expect(agent.assumptions).toEqual([]);
  });

  it('adds an executors CGT line when a gain is made over probate value', () => {
    const r = compareSaleRoutes({
      expectedPricePence: 300_000_00,
      agentFeePercent: 1,
      cgt: { probateValuePence: 250_000_00, seller: 'executors' },
    });
    const agent = route(r, 'estate_agent');
    const cgt = agent.costs.find((c) => c.label.startsWith('Capital Gains'));
    // gain = 300k - 250k - 3.6k fee = 46,400; - 3,000 allowance = 43,400; × 24%
    expect(cgt?.pence).toBe(10_416_00);
    expect(r.sources.some((s) => s.label.includes('24%'))).toBe(true);
  });

  it('rejects a missing or negative price', () => {
    expect(() => compareSaleRoutes({ expectedPricePence: 0 })).toThrow();
  });
});
