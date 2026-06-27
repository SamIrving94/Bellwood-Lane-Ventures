import { describe, expect, it } from 'vitest';
import { resolvePropertyLink } from '../lib/property-links';

// Locks the logic that decides whether a lead's stored URL is a trustworthy
// direct listing or whether we fall back to an address search — the fix for
// "links take you to broken/generic sites".

const base = { address: '12 Bellwood Lane', postcode: 'SW1A 1AA' };

describe('resolvePropertyLink', () => {
  it('trusts a real Rightmove property detail page', () => {
    const r = resolvePropertyLink({
      ...base,
      listingUrl: 'https://www.rightmove.co.uk/properties/123456789',
    });
    expect(r.isDirect).toBe(true);
    expect(r.url).toContain('rightmove.co.uk/properties/123456789');
    expect(r.label).toMatch(/Rightmove/);
  });

  it('trusts a Zoopla details page', () => {
    const r = resolvePropertyLink({
      ...base,
      listingUrl: 'https://www.zoopla.co.uk/for-sale/details/67890123',
    });
    expect(r.isDirect).toBe(true);
    expect(r.label).toMatch(/Zoopla/);
  });

  it('rejects a generic PropertyData page and falls back to address search', () => {
    const r = resolvePropertyLink({
      ...base,
      listingUrl: 'https://propertydata.co.uk/analytics/SW1A1AA',
    });
    expect(r.isDirect).toBe(false);
    expect(r.url).toContain('google.com/search');
    expect(r.url).toContain(encodeURIComponent('12 Bellwood Lane'));
    expect(r.label).toBe('Find property ↗');
  });

  it('rejects a portal homepage / search page (not a detail path)', () => {
    const r = resolvePropertyLink({
      ...base,
      listingUrl: 'https://www.rightmove.co.uk/property-for-sale/find.html',
    });
    expect(r.isDirect).toBe(false);
    expect(r.url).toContain('google.com/search');
  });

  it('falls back to address search when there is no URL at all', () => {
    const r = resolvePropertyLink({
      ...base,
      listingUrl: null,
      planningUrl: null,
    });
    expect(r.isDirect).toBe(false);
    expect(r.url).toContain('google.com/search');
  });

  it('uses a planning record URL as a direct link when no listing', () => {
    const r = resolvePropertyLink({
      ...base,
      listingUrl: null,
      planningUrl: 'https://planning.council.gov.uk/app/12345',
    });
    expect(r.isDirect).toBe(true);
    expect(r.url).toBe('https://planning.council.gov.uk/app/12345');
    expect(r.label).toMatch(/planning/i);
  });

  it('prefers a valid listing over a planning URL', () => {
    const r = resolvePropertyLink({
      ...base,
      listingUrl: 'https://www.onthemarket.com/details/9988776/',
      planningUrl: 'https://planning.council.gov.uk/app/12345',
    });
    expect(r.isDirect).toBe(true);
    expect(r.label).toMatch(/OnTheMarket/);
  });

  it('ignores a malformed URL and falls back safely', () => {
    const r = resolvePropertyLink({ ...base, listingUrl: 'not a url' });
    expect(r.isDirect).toBe(false);
    expect(r.url).toContain('google.com/search');
  });
});
