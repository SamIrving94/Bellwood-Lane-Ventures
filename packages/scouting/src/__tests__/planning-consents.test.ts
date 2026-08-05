/**
 * Locks the planning-consents source to the REAL brownfield-land API shape.
 *
 * The fixture is a live response captured via founder browser probe on
 * 2026-08-05 (the dev sandbox's egress is blocked by planning.data.gov.uk).
 * If the dataset drifts, these tests break instead of the weekly walk
 * silently going dark.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseBrownfieldPage } from '../planning-consents';
import { classifyTrack } from '../track';

const fixture = JSON.parse(
  readFileSync(
    join(__dirname, 'fixtures', 'planning-brownfield-live-2026-08-05.json'),
    'utf8'
  )
);

const NOW = new Date('2026-08-05T12:00:00Z');
const OPTS = { minPermissionAgeMonths: 18, now: NOW };

describe('parseBrownfieldPage (live 2026-08-05 fixture)', () => {
  it('keeps live permissioned sites and drops completed ones', () => {
    const { leads, scanned } = parseBrownfieldPage(fixture, OPTS);
    // BFR001 + BFR002 kept; BFR003 has an end-date (site completed).
    expect(scanned).toBe(3);
    expect(leads).toHaveLength(2);
    expect(leads.map((l) => l.planningSignal.reference)).toEqual([
      'BFR001',
      'BFR002',
    ]);
  });

  it('extracts address, postcode and permission date', () => {
    const { leads } = parseBrownfieldPage(fixture, OPTS);
    const lead = leads[0];
    expect(lead.address).toBe('Glendaragh, Barn Park Road, Teignmouth TQ14 8PN');
    expect(lead.postcode).toBe('TQ14 8PN');
    expect(lead.grantDate).toBe('2001-10-26');
    expect(lead.leadTypeHint).toBe('lapsing_consent');
    expect(lead.source).toBe('brownfield_register');
    expect(lead.planningSignal.maxDwellings).toBe(15);
    expect(lead.planningSignal.sitePlanUrl).toContain('teignbridge.gov.uk');
  });

  it('writes a dwelling count into the summary so blocks classify as block', () => {
    const { leads } = parseBrownfieldPage(fixture, OPTS);
    expect(leads[0].planningSignal.summary).toContain('15 dwellings');
    expect(
      classifyTrack({ valuePence: null, text: leads[0].planningSignal.summary })
    ).toBe('block');
  });

  it('drops sites whose permission is too fresh to read as stalled', () => {
    const { leads } = parseBrownfieldPage(fixture, {
      // 26 years: even the 2001 consent is "too fresh" → nothing kept.
      minPermissionAgeMonths: 26 * 12,
      now: NOW,
    });
    expect(leads).toHaveLength(0);
  });

  it('extracts the next pagination link', () => {
    const { nextUrl } = parseBrownfieldPage(fixture, OPTS);
    expect(nextUrl).toBe(
      'http://www.planning.data.gov.uk/entity.json?dataset=brownfield-land&limit=3&offset=3'
    );
  });
});
