import { describe, expect, it } from 'vitest';
import { classifyListingHtml } from '../listing-status';

describe('classifyListingHtml', () => {
  it('flags visible "Sold STC" page text', () => {
    const html =
      '<div class="_status"><span>Sold STC</span></div><h1>3 bed terraced house</h1>';
    const result = classifyListingHtml(html);
    expect(result.status).toBe('sstc');
    expect(result.marker?.toLowerCase()).toContain('sold stc');
  });

  it('flags "Sold Subject to Contract" long form', () => {
    const html = '<p>This property is Sold Subject to Contract.</p>';
    expect(classifyListingHtml(html).status).toBe('sstc');
  });

  it('flags machine tokens in embedded state JSON', () => {
    const html =
      '<script>window.__STATE__={"listingStatus":"sold_stc"}</script>';
    expect(classifyListingHtml(html).status).toBe('sstc');
  });

  it('flags "Under Offer" and "Sale Agreed"', () => {
    expect(classifyListingHtml('<span>Under Offer</span>').status).toBe('sstc');
    expect(classifyListingHtml('<span>Sale agreed</span>').status).toBe('sstc');
  });

  it('flags removed listings, and prefers removed over incidental SSTC text', () => {
    const html =
      '<h1>This property has been removed by the agent.</h1>' +
      '<div>Similar properties: <span>Sold STC</span></div>';
    const result = classifyListingHtml(html);
    expect(result.status).toBe('removed');
  });

  it('treats a normal live listing as live', () => {
    const html =
      '<h1>3 bed semi-detached house for sale</h1>' +
      '<p>Guide price £180,000. Offers in the region of. Chain free.</p>' +
      '<p>Understanding your offer options and the sales process.</p>';
    const result = classifyListingHtml(html);
    expect(result.status).toBe('live');
    expect(result.marker).toBeNull();
  });

  it('does not misfire on words containing marker fragments', () => {
    // "understated" / "stclair" must not match the sold-stc token patterns.
    const html = '<p>An understated home on StClair Road, Understanding.</p>';
    expect(classifyListingHtml(html).status).toBe('live');
  });
});
