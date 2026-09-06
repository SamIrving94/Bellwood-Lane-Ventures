/**
 * Ripe-for-modernisation assessor tests.
 *
 * The contract under test: ONLY positive evidence scores (unknown EPC,
 * missing dates, synthetic sales contribute nothing in either direction),
 * points cap at MODERNISATION_MAX_POINTS, and reasons read strongest-first
 * in founder English. Also covers the EPC-evidence path added to
 * assessPrimeOpportunity — the change that lets a probate lead (no badge,
 * no listing text) carry real condition evidence.
 *
 * Scorer wiring is type-checked and gated on `points > 0`; existing scorer
 * tests (which pass no modernisation signal) pin the no-regression case.
 */

import { describe, expect, it } from 'vitest';
import {
  MODERNISATION_MAX_POINTS,
  assessModernisation,
} from '../modernisation';
import { assessPrimeOpportunity } from '../track';

/** Fixed clock: date maths must not depend on when CI runs. */
const NOW = new Date('2026-08-30T00:00:00Z');

describe('assessModernisation', () => {
  it('scores an F-band certificate as the core evidence', () => {
    const a = assessModernisation({ epcRating: 'F' }, NOW);
    expect(a.points).toBe(6);
    expect(a.ripe).toBe(true);
    expect(a.reasons[0]).toContain('EPC F');
  });

  it('treats E as a faint signal, below the ripe line', () => {
    const a = assessModernisation({ epcRating: 'E' }, NOW);
    expect(a.points).toBe(3);
    expect(a.ripe).toBe(false);
    expect(a.strength).toBe('faint');
  });

  it('caps stacked evidence at MODERNISATION_MAX_POINTS and reads strongest-first', () => {
    const a = assessModernisation(
      {
        epcRating: 'G',
        epcInspectionDate: '2013-05-01',
        heatingType: 'Room heaters, electric',
        lastSaleDate: '1998-03-14',
      },
      NOW
    );
    expect(a.points).toBe(MODERNISATION_MAX_POINTS);
    expect(a.strength).toBe('strong');
    expect(a.ripe).toBe(true);
    // Strongest first: the G band (6) leads the tenure (5) and the rest.
    expect(a.reasons[0]).toContain('EPC G');
    expect(a.reasons.join(' ')).toContain('1998');
    expect(a.reasons.join(' ')).toContain('2013');
  });

  it('scores certificate age only past the ten-year lapse', () => {
    const old = assessModernisation({ epcInspectionDate: '2014-01-01' }, NOW);
    expect(old.points).toBe(3);
    expect(old.reasons[0]).toContain('2014');

    const recent = assessModernisation(
      { epcInspectionDate: '2024-01-01' },
      NOW
    );
    expect(recent.points).toBe(0);
  });

  it('recognises dated heating language but not modern systems', () => {
    expect(
      assessModernisation({ heatingType: 'Back boiler to radiators' }, NOW)
        .points
    ).toBe(4);
    expect(
      assessModernisation({ heatingType: 'No central heating' }, NOW).points
    ).toBe(4);
    expect(
      assessModernisation(
        { heatingType: 'Boiler and radiators, mains gas' },
        NOW
      ).points
    ).toBe(0);
  });

  it('grades tenure by years since the last REAL sale', () => {
    const veryLong = assessModernisation({ lastSaleDate: '1999-06-01' }, NOW);
    expect(veryLong.points).toBe(5);
    expect(veryLong.ripe).toBe(true);

    const long = assessModernisation({ lastSaleDate: '2009-06-01' }, NOW);
    expect(long.points).toBe(3);

    const recent = assessModernisation({ lastSaleDate: '2020-06-01' }, NOW);
    expect(recent.points).toBe(0);
  });

  it('takes the badge over the text, never both', () => {
    const badged = assessModernisation(
      {
        listingType: 'unmodernised-properties',
        text: 'A house in need of full modernisation',
      },
      NOW
    );
    expect(badged.points).toBe(6);
    expect(badged.reasons).toHaveLength(1);

    const textOnly = assessModernisation(
      { text: 'A rare renovation project on a quiet road' },
      NOW
    );
    expect(textOnly.points).toBe(4);
  });

  it('scores nothing when nothing is known — unknown is not evidence', () => {
    const a = assessModernisation({}, NOW);
    expect(a.points).toBe(0);
    expect(a.ripe).toBe(false);
    expect(a.strength).toBe('none');
    expect(a.reasons).toEqual([]);
    // A good EPC is also not "ripe" evidence.
    expect(assessModernisation({ epcRating: 'B' }, NOW).points).toBe(0);
  });
});

describe('assessPrimeOpportunity — EPC condition evidence', () => {
  it('lets an F-band certificate stand as the condition reason', () => {
    const opp = assessPrimeOpportunity({
      valuePence: 900_000_00,
      areaAvgPence: 1_400_000_00,
      epcRating: 'F',
      epcInspectionDate: '2013-05-01',
    });
    expect(opp.isRefurbCandidate).toBe(true);
    expect(opp.isOpportunity).toBe(true);
    expect(opp.reasons.join(' ')).toContain('EPC F');
    expect(opp.reasons.join(' ')).toContain('2013');
  });

  it('does not let a D band masquerade as condition evidence', () => {
    const opp = assessPrimeOpportunity({
      valuePence: 900_000_00,
      areaAvgPence: 1_400_000_00,
      epcRating: 'D',
    });
    expect(opp.isRefurbCandidate).toBe(false);
    // The honest warning stays: discounted with no fixable reason found.
    expect(opp.reasons.join(' ')).toContain('check why');
  });

  it('prefers the explicit badge reason over the EPC when both exist', () => {
    const opp = assessPrimeOpportunity({
      valuePence: 900_000_00,
      areaAvgPence: 1_400_000_00,
      listingType: 'unmodernised-properties',
      epcRating: 'F',
    });
    expect(opp.isRefurbCandidate).toBe(true);
    expect(opp.reasons.join(' ')).toContain('unmodernised properties');
  });
});
