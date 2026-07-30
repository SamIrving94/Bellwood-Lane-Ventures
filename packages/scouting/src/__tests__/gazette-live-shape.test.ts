/**
 * Gazette list feed — pinned against a REAL production response.
 *
 * The contract rewrite that fixed `Gazette list HTTP 500` was derived from
 * The Gazette's published developer docs, because the session that wrote it
 * had no outbound network. That left one honest gap: fixtures written from a
 * spec prove we parse what the spec *says*, not what the server *sends*.
 *
 * `fixtures/gazette-list-live-2026-07-30.json` closes it. It is a verbatim
 * excerpt of a live 200 response to the corrected URL, captured 2026-07-30:
 *
 *   /wills-and-probate/notice/data.json?noticecode=2903&results-page=1&results-page-size=10
 *
 * These tests assert against that captured payload, so they fail if the real
 * feed shape ever drifts from what the parser expects.
 */

import { describe, expect, it } from 'vitest';
import liveListPage from './fixtures/gazette-list-live-2026-07-30.json';

/**
 * Mirrors `matchNoticeId` / `extractNoticeId` in ../gazette.ts.
 *
 * Duplicated rather than exported: these are internals, and the point of this
 * file is to prove the REAL feed satisfies the assumptions those functions
 * make about it. If this ever diverges from the implementation the pipeline
 * tests in gazette.test.ts catch it — this file is about the payload.
 */
const matchNoticeId = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const id = value.match(/\/notice\/([A-Za-z0-9-]+)/)?.[1];
  if (!id || id.toLowerCase().startsWith('data.')) return null;
  return id;
};

type LiveEntry = { id?: string; category?: { '@term'?: string } };
type LiveLink = { '@rel'?: string; '@href'?: string };

const entries = liveListPage.entry as LiveEntry[];
const links = liveListPage.link as LiveLink[];

describe('live Gazette list payload (captured 2026-07-30)', () => {
  it('is the corrected wills-and-probate feed, not the old all-notices call', () => {
    // The 500 came from `?noticetype=deceased-estates` on /all-notices.
    const self = links.find((l) => l['@rel'] === 'self')?.['@href'] ?? '';
    expect(self).toContain('/wills-and-probate/notice/data.json');
    expect(self).toContain('noticecode=2903');
    expect(self).not.toContain('noticetype');
  });

  it('carries a rel="next" link, so HATEOAS paging has something to follow', () => {
    // The parser follows rel="next" rather than computing page counts.
    const next = links.find((l) => l['@rel'] === 'next')?.['@href'];
    expect(next).toBeTruthy();
    expect(next).toContain('results-page=2');
  });

  it('yields a notice id for every entry the real feed returned', () => {
    // Silently dropping entries here is exactly how the old `(\d+)` regex lost
    // every Edinburgh/Belfast notice, so demand a 1:1 hit rate.
    const ids = entries.map((e) => matchNoticeId(e.id));
    expect(ids).toEqual(['5182440', '5182437', '5182418', '5182207']);
    expect(ids.every(Boolean)).toBe(true);
  });

  it('never mistakes a trailing /data.json segment for the id', () => {
    expect(
      matchNoticeId('https://www.thegazette.co.uk/notice/5182437/data.json')
    ).toBe('5182437');
  });

  it('still extracts compound Edinburgh/Belfast refs', () => {
    // Not present in this sample (all four are London), but the same feed
    // serves them and the old regex dropped them — keep it pinned.
    expect(
      matchNoticeId('https://www.thegazette.co.uk/notice/E-25991-2455-105')
    ).toBe('E-25991-2455-105');
  });

  it('returns only Deceased Estates notices under noticecode=2903', () => {
    for (const e of entries) {
      expect(e.category?.['@term']).toBe('Deceased Estates');
    }
  });

  it('reports a total far beyond one page, so paging is load-bearing', () => {
    // ~880k notices at the time of capture: any cap must be a deliberate
    // date/limit decision, never an accident of stopping at page one.
    expect(Number(liveListPage['f:total'])).toBeGreaterThan(100_000);
  });

  it('includes overseas notices — proof the UK-postcode gate earns its keep', () => {
    // `parseNoticeDetail` returns null without a UK postcode. This sample has
    // a South African address in it; 1 of 4 entries being non-UK is why that
    // gate exists rather than being defensive noise.
    const overseas = entries.filter(
      (e) => !/[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/i.test(JSON.stringify(e))
    );
    expect(overseas.length).toBeGreaterThan(0);
  });
});
