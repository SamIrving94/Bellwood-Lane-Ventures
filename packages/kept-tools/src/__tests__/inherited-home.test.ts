import { describe, expect, it } from 'vitest';
import {
  addMonths,
  executorAllowanceEnds,
  ihtDueDate,
  planInheritedHome,
} from '../inherited-home';

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const iso = (x: Date) => x.toISOString().slice(0, 10);

describe('date rules', () => {
  it('IHT is due at the end of the sixth month after the month of death', () => {
    expect(iso(ihtDueDate(d('2026-01-15')))).toBe('2026-07-31');
    expect(iso(ihtDueDate(d('2026-08-31')))).toBe('2027-02-28');
  });

  it('addMonths clamps to the last day of the month', () => {
    expect(iso(addMonths(d('2026-08-31'), 6))).toBe('2027-02-28');
    expect(iso(addMonths(d('2026-03-10'), 12))).toBe('2027-03-10');
  });

  it('executors allowance covers the tax year of death plus two', () => {
    // Died 1 May 2026 → tax year 2026–27 → window ends 5 April 2029
    expect(iso(executorAllowanceEnds(d('2026-05-01')))).toBe('2029-04-05');
    // Died 5 April 2026 → tax year 2025–26 → ends 5 April 2028
    expect(iso(executorAllowanceEnds(d('2026-04-05')))).toBe('2028-04-05');
    expect(iso(executorAllowanceEnds(d('2026-04-06')))).toBe('2029-04-05');
  });
});

describe('planInheritedHome', () => {
  it('builds a dated plan with council tax dates once there is a grant', () => {
    const plan = planInheritedHome({
      dateOfDeath: '2026-06-10',
      grantDate: '2026-09-20',
      homeIsEmpty: true,
      today: '2026-10-01',
    });
    const titles = plan.milestones.map((m) => m.title);
    expect(titles).toContain('Council tax exemption ends');
    const exemption = plan.milestones.find(
      (m) => m.title === 'Council tax exemption ends'
    );
    expect(exemption?.date).toBe('2027-03-20');
    expect(exemption?.status).toBe('upcoming');
    const iht = plan.milestones.find((m) => m.title.startsWith('Inheritance'));
    expect(iht?.date).toBe('2026-12-31');
    expect(titles).toContain('You can now sell');
  });

  it('sorts dated milestones before event-based ones', () => {
    const plan = planInheritedHome({
      dateOfDeath: '2026-06-10',
      homeIsEmpty: true,
      today: '2026-10-01',
    });
    const dates = plan.milestones.filter((m) => m.date).map((m) => m.date);
    expect(dates).toEqual([...dates].sort());
    expect(plan.milestones.at(-1)?.status).toBe('when_you_sell');
  });

  it('without a grant, says a sale can be agreed but not completed', () => {
    const plan = planInheritedHome({
      dateOfDeath: '2026-06-10',
      homeIsEmpty: false,
      today: '2026-10-01',
    });
    expect(plan.milestones.map((m) => m.title)).not.toContain(
      'Council tax exemption ends'
    );
    expect(
      plan.milestones.find((m) => m.status === 'when_you_sell')?.detail
    ).toMatch(/cannot complete until probate is granted/);
  });

  it('flags past steps and leaves out England-only council tax rules elsewhere', () => {
    const plan = planInheritedHome({
      dateOfDeath: '2026-01-02',
      grantDate: '2026-05-01',
      homeIsEmpty: true,
      nation: 'scotland',
      today: '2026-10-01',
    });
    expect(plan.milestones.some((m) => m.title.startsWith('Council tax'))).toBe(
      false
    );
    expect(plan.notes.join(' ')).toMatch(/England only/);
    expect(
      plan.milestones.find((m) => m.title.startsWith('Inheritance'))?.status
    ).toBe('done_or_past');
  });

  it('adds the winter drain-down item for an empty home in autumn', () => {
    const plan = planInheritedHome({
      dateOfDeath: '2026-06-10',
      homeIsEmpty: true,
      today: '2026-10-01',
    });
    expect(plan.checklist.join(' ')).toMatch(/draining down/);
  });

  it('rejects impossible dates', () => {
    expect(() =>
      planInheritedHome({ dateOfDeath: '2026-02-30', homeIsEmpty: true })
    ).toThrow(/not a real date/);
    expect(() =>
      planInheritedHome({
        dateOfDeath: '2026-06-10',
        grantDate: '2026-01-01',
        homeIsEmpty: true,
        today: '2026-10-01',
      })
    ).toThrow(/before dateOfDeath/);
    expect(() =>
      planInheritedHome({
        dateOfDeath: '2027-01-01',
        homeIsEmpty: true,
        today: '2026-10-01',
      })
    ).toThrow(/future/);
  });
});
