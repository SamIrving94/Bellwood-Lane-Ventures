import { describe, expect, it } from 'vitest';
import { planSale } from '../sale-plan';
import { SITUATIONS, SITUATION_INFO } from '../situations';

const PLAN_SITUATIONS = SITUATIONS.filter((s) => s !== 'inherited');
const BROKER = /mortgage broker/;
const SHARE_ASSUMED = /assumed to be 50%/;
const DISPUTE = /active legal dispute/;
const STEPCHANGE = /StepChange/;

describe('planSale', () => {
  it('says which ways to sell can finish by the date the user has', () => {
    const plan = planSale({
      situation: 'chain_break',
      mustCompleteBy: '2027-01-09',
      today: '2026-11-28',
    });
    const byRoute = Object.fromEntries(plan.timing.map((t) => [t.route, t]));
    expect(byRoute.estate_agent?.completesAround).toBe('2027-04-28');
    expect(byRoute.estate_agent?.meetsDeadline).toBe(false);
    expect(byRoute.auction?.meetsDeadline).toBe(false);
    expect(byRoute.cash_buyer?.completesAround).toBe('2026-12-28');
    expect(byRoute.cash_buyer?.meetsDeadline).toBe(true);
    expect(byRoute.cash_buyer?.daysToSpare).toBe(12);
  });

  it('leaves the deadline columns empty when there is no date', () => {
    const plan = planSale({ situation: 'relocation', today: '2026-11-28' });
    expect(plan.mustCompleteBy).toBeNull();
    expect(plan.timing.every((t) => t.meetsDeadline === null)).toBe(true);
    expect(plan.money).toBeNull();
  });

  it('works out each share after fees and the mortgage for a separation', () => {
    const plan = planSale({
      situation: 'separation',
      expectedPricePence: 300_000_00,
      mortgageOwedPence: 180_000_00,
      today: '2026-11-28',
    });
    expect(plan.sharePercent).toBe(50);
    const agent = plan.money?.find((m) => m.route === 'estate_agent');
    // £300,000 − 1.25% + VAT (£4,500) = £295,500; − £180,000 = £115,500; half
    expect(agent?.netPence).toBe(295_500_00);
    expect(agent?.afterMortgagePence).toBe(115_500_00);
    expect(agent?.yourSharePence).toBe(57_750_00);
    const cash = plan.money?.find((m) => m.route === 'cash_buyer');
    expect(cash?.netPence).toBeNull();
    expect(plan.notes.join(' ')).toMatch(SHARE_ASSUMED);
    expect(plan.notes.join(' ')).toMatch(DISPUTE);
  });

  it('stops and points to free debt advice when the debt is bigger than the home', () => {
    const plan = planSale({
      situation: 'other',
      expectedPricePence: 150_000_00,
      mortgageOwedPence: 170_000_00,
      today: '2026-11-28',
    });
    expect(plan.debtExceedsValue).toBe(true);
    expect(plan.freeHelp?.url).toBe('https://www.stepchange.org');
    expect(plan.notes[0]).toMatch(STEPCHANGE);
  });

  it('carries every situation page’s own honest line and a checklist', () => {
    for (const situation of PLAN_SITUATIONS) {
      const plan = planSale({ situation, today: '2026-11-28' });
      expect(plan.honest).toBe(SITUATION_INFO[situation].honest);
      expect(plan.checklist.length).toBeGreaterThanOrEqual(5);
    }
    expect(
      planSale({
        situation: 'problem_property',
        today: '2026-11-28',
      }).checklist.join(' ')
    ).toMatch(BROKER);
  });

  it('never produces a figure the user did not give', () => {
    const plan = planSale({
      situation: 'problem_property',
      mustCompleteBy: '2027-06-01',
      today: '2026-11-28',
    });
    expect(plan.money).toBeNull();
    expect(JSON.stringify(plan)).not.toMatch(/£\d/);
  });

  it('rejects impossible input', () => {
    expect(() =>
      planSale({
        situation: 'relocation',
        mustCompleteBy: '2026-01-01',
        today: '2026-11-28',
      })
    ).toThrow(/past/);
    expect(() =>
      planSale({
        situation: 'separation',
        sharePercent: 0,
        today: '2026-11-28',
      })
    ).toThrow(/between 1 and 100/);
    expect(() =>
      planSale({ situation: 'inherited' as never, today: '2026-11-28' })
    ).toThrow(/inherited-home plan/);
  });
});
