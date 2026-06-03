'use client';

import 'driver.js/dist/driver.css';
import { driver } from 'driver.js';
import { TOURS, type TourId, tourIdForPath } from './tours';

/**
 * Drive a single tour by id. Safe to call from any client component.
 *
 * In development we warn if any step's selector cannot be resolved at
 * the moment the tour starts — that surfaces sidebar refactors or
 * page-level data-tour attrs that have drifted away from tours.ts.
 */
export function runTour(tourId: string): void {
  const steps = TOURS[tourId as TourId];
  if (!steps || steps.length === 0) {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.warn('[tour] unknown tour id', tourId);
    }
    return;
  }

  if (process.env.NODE_ENV === 'development' && typeof document !== 'undefined') {
    for (const step of steps) {
      if (step.element && !document.querySelector(step.element)) {
        // eslint-disable-next-line no-console
        console.warn('[tour] missing selector', step.element);
      }
    }
  }

  const tour = driver({
    showProgress: true,
    showButtons: ['next', 'previous', 'close'],
    nextBtnText: 'Next',
    prevBtnText: 'Back',
    doneBtnText: 'Done',
    steps,
  });

  tour.drive();
}

/**
 * Pick the right tour for a pathname and run it.
 *
 * Wired to the topbar Start tour button. The pathname → tour mapping
 * lives in tours.ts so the routing rule and the step data sit next to
 * each other.
 */
export function runTourForPath(pathname: string): void {
  runTour(tourIdForPath(pathname));
}
