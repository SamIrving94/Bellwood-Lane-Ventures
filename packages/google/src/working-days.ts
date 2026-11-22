const LONDON = 'Europe/London';

/** The calendar date in London (YYYY-MM-DD) for an instant. */
export const londonDate = (instant: Date): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: LONDON,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);

const toUtc = (date: string): Date => new Date(`${date}T00:00:00Z`);
const fromUtc = (date: Date): string => date.toISOString().slice(0, 10);

export const addDays = (date: string, days: number): string => {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
};

/**
 * Add working days to a YYYY-MM-DD date, skipping Saturdays and Sundays.
 *
 * Bank holidays are NOT skipped. That errs early, never late: on a
 * bank-holiday week the reminder lands a day before the true deadline.
 * The public promise is a written offer within two working days of
 * viewing, so an early nudge is the safe side to be wrong on.
 */
export const addWorkingDays = (date: string, days: number): string => {
  let current = date;
  let remaining = days;
  while (remaining > 0) {
    current = addDays(current, 1);
    const weekday = toUtc(current).getUTCDay();
    if (weekday !== 0 && weekday !== 6) {
      remaining -= 1;
    }
  }
  return current;
};

/** Working days we promise between viewing and written offer (live site). */
export const OFFER_WORKING_DAYS = 2;

/** The date the written offer is due for a viewing at `viewedAt`. */
export const offerDueDate = (viewedAt: Date): string =>
  addWorkingDays(londonDate(viewedAt), OFFER_WORKING_DAYS);
