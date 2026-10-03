/**
 * Inherited home: what now? — a dated plan for the house, from the date of
 * death and (if known) the grant of probate.
 *
 * Every date is computed from a published rule in ./sources.ts. The plan is
 * general information for England (council tax rules differ in Wales and
 * Scotland, and the death-registration rule differs in Scotland), never
 * legal or tax advice — the same footing as the /probate page.
 *
 * Firewall (docs/proposals/keyhole-probate-shelf-tree.md): the dates a user
 * enters are used to compute this answer and nothing else. They are never
 * stored or fed to scouting.
 */

import { SOURCES, type Source } from './sources';

export type Nation = 'england' | 'wales' | 'scotland' | 'northern_ireland';

export interface PlanInheritedHomeInput {
  /** YYYY-MM-DD */
  dateOfDeath: string;
  /** YYYY-MM-DD, if probate / letters of administration have been granted. */
  grantDate?: string;
  /** True if nobody is living in the home. */
  homeIsEmpty: boolean;
  nation?: Nation;
  /** YYYY-MM-DD. Defaults to today; injectable for tests. */
  today?: string;
}

export type MilestoneStatus =
  | 'done_or_past'
  | 'due_soon'
  | 'upcoming'
  | 'when_you_sell';

export interface Milestone {
  /** YYYY-MM-DD, or null for steps tied to an event (e.g. completion). */
  date: string | null;
  title: string;
  detail: string;
  status: MilestoneStatus;
  source: Source;
}

export interface InheritedHomePlan {
  milestones: Milestone[];
  checklist: string[];
  notes: string[];
  sources: Source[];
}

const DAY_MS = 86_400_000;
const DUE_SOON_DAYS = 30;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseIsoDate(value: string, field: string): Date {
  if (!ISO_DATE.test(value)) {
    throw new Error(`${field} must be a date in YYYY-MM-DD format`);
  }
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) {
    throw new Error(`${field} is not a real date`);
  }
  return d;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}

/** Same day-of-month N months later, clamped to the month's last day. */
export function addMonths(d: Date, months: number): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), lastDay)));
}

/** Last day of the sixth month after the month of death (died January → 31 July). */
export function ihtDueDate(dateOfDeath: Date): Date {
  return new Date(
    Date.UTC(dateOfDeath.getUTCFullYear(), dateOfDeath.getUTCMonth() + 7, 0)
  );
}

/**
 * 5 April that ends the executors' CGT allowance window: the tax year of
 * death plus the two after it. UK tax years run 6 April – 5 April.
 */
export function executorAllowanceEnds(dateOfDeath: Date): Date {
  const y = dateOfDeath.getUTCFullYear();
  const beforeSixApril =
    dateOfDeath.getUTCMonth() < 3 ||
    (dateOfDeath.getUTCMonth() === 3 && dateOfDeath.getUTCDate() <= 5);
  const taxYearEndYear = beforeSixApril ? y : y + 1;
  return new Date(Date.UTC(taxYearEndYear + 2, 3, 5));
}

function statusFor(date: Date, today: Date): MilestoneStatus {
  const diffDays = Math.round((date.getTime() - today.getTime()) / DAY_MS);
  if (diffDays < 0) return 'done_or_past';
  if (diffDays <= DUE_SOON_DAYS) return 'due_soon';
  return 'upcoming';
}

export function planInheritedHome(
  input: PlanInheritedHomeInput
): InheritedHomePlan {
  const death = parseIsoDate(input.dateOfDeath, 'dateOfDeath');
  const today = parseIsoDate(
    input.today ?? new Date().toISOString().slice(0, 10),
    'today'
  );
  const grant = input.grantDate
    ? parseIsoDate(input.grantDate, 'grantDate')
    : null;
  if (death.getTime() > today.getTime()) {
    throw new Error('dateOfDeath cannot be in the future');
  }
  if (grant && grant.getTime() < death.getTime()) {
    throw new Error('grantDate cannot be before dateOfDeath');
  }
  const nation = input.nation ?? 'england';

  const dated: Array<Omit<Milestone, 'status'> & { at: Date }> = [];

  if (nation === 'england' || nation === 'wales') {
    const at = addDays(death, 5);
    dated.push({
      at,
      date: iso(at),
      title: 'Register the death',
      detail:
        'Within 5 days in England and Wales, unless the coroner is involved.',
      source: SOURCES.registerDeath,
    });
  }

  if (input.homeIsEmpty) {
    const at = addDays(death, 30);
    dated.push({
      at,
      date: iso(at),
      title: 'Check the home insurance covers an empty home',
      detail:
        'Standard cover often stops after 30 to 60 days empty. Tell the insurer now and ask about unoccupied-property cover.',
      source: SOURCES.emptyInsurance,
    });
  }

  const iht = ihtDueDate(death);
  dated.push({
    at: iht,
    date: iso(iht),
    title: 'Inheritance Tax due (if the estate owes any)',
    detail:
      'Payment is due by the end of the sixth month after the death. HMRC charges interest after this date.',
    source: SOURCES.ihtDue,
  });

  if (grant && input.homeIsEmpty && nation === 'england') {
    const exemptionEnds = addMonths(grant, 6);
    dated.push({
      at: exemptionEnds,
      date: iso(exemptionEnds),
      title: 'Council tax exemption ends',
      detail:
        'The empty home stays exempt for up to 6 months after the grant, while it is not sold or transferred to a beneficiary. Normal council tax applies after that.',
      source: SOURCES.councilTaxProbate,
    });
    const premiumException = addMonths(grant, 12);
    dated.push({
      at: premiumException,
      date: iso(premiumException),
      title: 'Empty-home premium protection ends',
      detail:
        'No long-term empty premium for 12 months from the grant. After that the council may charge one if the home is still empty and unsold.',
      source: SOURCES.councilTaxProbate,
    });
  }

  const allowanceEnds = executorAllowanceEnds(death);
  dated.push({
    at: allowanceEnds,
    date: iso(allowanceEnds),
    title: "Executors' CGT allowance window closes",
    detail:
      'If the executors sell, they get the annual CGT allowance in the tax year of death and the two after it.',
    source: SOURCES.cgtAllowance,
  });

  const milestones: Milestone[] = dated
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .map(({ at, ...m }) => ({ ...m, status: statusFor(at, today) }));

  milestones.push(
    {
      date: null,
      title: grant
        ? 'You can now sell'
        : 'Agree a sale before the grant if you wish',
      detail: grant
        ? 'The grant is in place, so a sale can complete.'
        : 'You can agree a sale now, but it cannot complete until probate is granted.',
      status: 'when_you_sell',
      source: SOURCES.saleBeforeGrant,
    },
    {
      date: null,
      title: 'Report any Capital Gains Tax within 60 days of completion',
      detail:
        'If the home sells for more than its probate value (after costs), report and pay any CGT within 60 days of completing.',
      status: 'when_you_sell',
      source: SOURCES.cgt60Days,
    }
  );

  const checklist: string[] = [];
  if (input.homeIsEmpty) {
    checklist.push(
      'Visit regularly and keep a dated log of each visit.',
      'Redirect post and cancel services that are not needed.',
      'Take meter readings and tell the energy and water suppliers.',
      'Remove valuables and important papers.'
    );
    const month = today.getUTCMonth();
    const winterSoon = month >= 9 || month <= 2;
    if (winterSoon) {
      checklist.push(
        'Before frosts: ask a plumber about draining down the water system, or keep the heating on low. Check what the insurer requires.'
      );
    }
  }
  if (!grant) {
    checklist.push(
      'Ask the solicitor or probate service for a realistic grant date.'
    );
  }

  const notes = [
    "General information, not legal or tax advice. For the estate's position, speak to a solicitor.",
  ];
  if (nation !== 'england') {
    notes.push(
      'The council tax dates are for England only and are left out. Rules differ in Wales, Scotland and Northern Ireland.'
    );
  }
  if (!grant) {
    notes.push(
      'Add the grant date when you have it to see the council tax dates.'
    );
  }

  const sources = Array.from(new Set(milestones.map((m) => m.source)));

  return { milestones, checklist, notes, sources };
}
