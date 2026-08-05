/**
 * Locks the receivership source to the REAL Gazette insolvency feed shape.
 *
 * The fixture is a live response captured via browser on 2026-08-05 (the
 * founder ran the probe — the dev sandbox's egress is blocked by The
 * Gazette). If the feed drifts, these tests break instead of the cron
 * silently going dark. Two hard-won learnings it asserts:
 *
 *  1. `noticecode` filters are NOT sent — a wrong code value 500s the search
 *     backend. Filtering happens client-side on category['@term'].
 *  2. Company numbers appear in content in two shapes:
 *     "(Company Number 11416317 )" and "Company Number: 09184913".
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  extractCompanyNumber,
  parseInsolvencyFeedPage,
} from '../receiverships';

const fixture = JSON.parse(
  readFileSync(
    join(__dirname, 'fixtures', 'gazette-insolvency-live-2026-08-05.json'),
    'utf8'
  )
);

const CUTOFF_BEFORE_ALL = new Date('2026-08-01T00:00:00Z');
const CUTOFF_AFTER_ALL = new Date('2026-08-06T00:00:00Z');

describe('parseInsolvencyFeedPage (live 2026-08-05 fixture)', () => {
  it('keeps appointment notices and drops the rest by category term', () => {
    const { notices } = parseInsolvencyFeedPage(fixture, CUTOFF_BEFORE_ALL);
    // Fixture: 2x "Meetings of Creditors" (dropped), 1x "Appointment of
    // Liquidators" (kept).
    expect(notices).toHaveLength(1);
    expect(notices[0].companyName).toBe('LETISHA HEALTHCARE LIMITED');
    expect(notices[0].categoryTerm).toBe('Appointment of Liquidators');
    expect(notices[0].noticeCode).toBe('2443');
    expect(notices[0].id).toBe('5185493');
  });

  it('carries content into searchText so the company number is findable', () => {
    const { notices } = parseInsolvencyFeedPage(fixture, CUTOFF_BEFORE_ALL);
    expect(extractCompanyNumber(notices[0].searchText)).toBe('09184913');
  });

  it('signals reachedCutoff when entries are older than the window', () => {
    const { notices, reachedCutoff } = parseInsolvencyFeedPage(
      fixture,
      CUTOFF_AFTER_ALL
    );
    expect(notices).toHaveLength(0);
    expect(reachedCutoff).toBe(true);
  });

  it('extracts the rel=next pagination link (HATEOAS)', () => {
    const { nextUrl } = parseInsolvencyFeedPage(fixture, CUTOFF_BEFORE_ALL);
    expect(nextUrl).toBe(
      'https://www.thegazette.co.uk/insolvency/notice/data.json?results-page=2'
    );
  });

  it('resolves the plain notice URL for the kept entry', () => {
    const { notices } = parseInsolvencyFeedPage(fixture, CUTOFF_BEFORE_ALL);
    expect(notices[0].link).toBe('https://www.thegazette.co.uk/notice/5185493');
  });
});

describe('extractCompanyNumber — both live formats', () => {
  it('parses "(Company Number 11416317 )" with the stray space', () => {
    expect(
      extractCompanyNumber(
        'MEGMAY CONSULTING LIMITED (Company Number 11416317 ) Trading Name: MegMay'
      )
    ).toBe('11416317');
  });

  it('parses "Company Number: 09184913"', () => {
    expect(
      extractCompanyNumber(
        'Name of Company: LETISHA HEALTHCARE LIMITED Company Number: 09184913'
      )
    ).toBe('09184913');
  });

  it('pads short numbers and returns null when absent', () => {
    expect(extractCompanyNumber('(Company Number 530703)')).toBe('00530703');
    expect(extractCompanyNumber('no number in this text')).toBeNull();
  });
});
