import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@repo/ai/claude', () => ({
  CLAUDE_HAIKU: 'claude-haiku-4-5',
  callClaudeForObject: vi.fn(),
}));

import { callClaudeForObject } from '@repo/ai/claude';
import {
  LOT_EXTRACT_FEATURE,
  discoverCatalogueLinks,
  extractLotsFromHtml,
  htmlToReadableText,
  validPostcode,
} from '../llm-lot-extract';

const PAGE_URL = 'https://www.example-auctions.co.uk/catalogue';

const CATALOGUE_HTML = `
<html><head><title>Catalogue</title><script>var x = 1;</script>
<style>.a{color:red}</style></head>
<body>
<nav><a href="/login">Login</a></nav>
<h1>Auction 14 October 2026</h1>
<div class="lot"><span>Lot 1</span>
  <a href="/lots/1">4 Station Road, Margate, Kent CT9 1AB</a>
  <p>Guide Price £120,000+</p><p>Three bedroom terraced house requiring modernisation.</p></div>
<div class="lot"><span>Lot 2</span>
  <a href="/lots/2">Flat 3, 10 Marine Parade, Brighton BN2 1TL</a>
  <p>Guide £95k - £110k</p><p>Leasehold flat, vacant possession.</p></div>
${'<p>padding text to get the page over the minimum length threshold for a real catalogue page. </p>'.repeat(4)}
<footer>© Example Auctions</footer>
</body></html>`;

beforeEach(() => {
  vi.mocked(callClaudeForObject).mockReset();
});

describe('htmlToReadableText', () => {
  it('drops chrome, keeps lots, and keeps links inline as markdown', () => {
    const text = htmlToReadableText(CATALOGUE_HTML, PAGE_URL);
    expect(text).not.toContain('var x = 1');
    expect(text).not.toContain('color:red');
    expect(text).not.toContain('Login');
    expect(text).not.toContain('© Example');
    expect(text).toContain('Lot 1');
    expect(text).toContain(
      '[4 Station Road, Margate, Kent CT9 1AB](https://www.example-auctions.co.uk/lots/1)'
    );
    expect(text).toContain('Guide Price £120,000+');
  });
});

describe('discoverCatalogueLinks', () => {
  it('finds catalogue-shaped links and skips results / pdf / login', () => {
    const html = `
      <a href="/auction-catalogue/oct-2026">View catalogue</a>
      <a href="/results">Results</a>
      <a href="/catalogue.pdf">Download catalogue PDF</a>
      <a href="/login">Login</a>
      <a href="/about">About</a>
      <a href="/auction-catalogue/oct-2026">View catalogue</a>`;
    expect(discoverCatalogueLinks(html, 'https://house.co.uk/')).toEqual([
      'https://house.co.uk/auction-catalogue/oct-2026',
    ]);
  });
});

describe('validPostcode', () => {
  it('normalises a real postcode and refuses a made-up one', () => {
    expect(validPostcode('ct91ab')).toBe('CT9 1AB');
    expect(validPostcode('4 Station Road, Margate CT9 1AB')).toBe('CT9 1AB');
    expect(validPostcode('Margate')).toBeNull();
    expect(validPostcode(null)).toBeNull();
  });
});

describe('extractLotsFromHtml', () => {
  it('routes through the shared client on Haiku with the feature tag', async () => {
    vi.mocked(callClaudeForObject).mockResolvedValue({ lots: [] } as never);
    await extractLotsFromHtml({
      html: CATALOGUE_HTML,
      pageUrl: PAGE_URL,
      sourceHouse: 'savills',
      tag: 'auctions/savills',
    });
    const call = vi.mocked(callClaudeForObject).mock.calls[0][0];
    expect(call.feature).toBe(LOT_EXTRACT_FEATURE);
    expect(call.feature).toBe('auction_lot_extract');
    expect(call.model).toBe('claude-haiku-4-5');
    expect(call.user).toContain('Lot 1');
  });

  it('parses money by code, validates postcodes, and drops what it cannot trust', async () => {
    vi.mocked(callClaudeForObject).mockResolvedValue({
      lots: [
        {
          lotNumber: 'Lot 1',
          address: '4 Station Road, Margate, Kent CT9 1AB',
          postcode: 'CT9 1AB',
          guideText: 'Guide Price £120,000+',
          auctionDate: '2026-10-14',
          lotUrl: '/lots/1',
          propertyType: 'terraced_house',
          description: 'Three bedroom terraced house requiring modernisation.',
        },
        {
          lotNumber: 'Lot 2',
          address: 'Flat 3, 10 Marine Parade, Brighton',
          // The model "helpfully" invented a postcode shape that is not UK.
          postcode: 'BRIGHTON 1',
          guideText: 'Guide £95k - £110k',
          auctionDate: null,
          lotUrl: null,
          propertyType: 'flat',
          description: 'Leasehold flat',
        },
        {
          lotNumber: 'Lot 3',
          address: 'Land at Somewhere Lane, Kent TN1 2XY',
          postcode: null,
          guideText: '£150k',
          auctionDate: 'next month',
          lotUrl: 'https://www.example-auctions.co.uk/lots/3',
          propertyType: 'land',
          description: 'Paddock',
        },
        {
          lotNumber: null,
          address: '',
          postcode: 'CT9 1AB',
          guideText: null,
          auctionDate: null,
          lotUrl: null,
          propertyType: 'other',
          description: 'ghost row',
        },
      ],
    } as never);

    const lots = await extractLotsFromHtml({
      html: CATALOGUE_HTML,
      pageUrl: PAGE_URL,
      sourceHouse: 'clive_emson',
      tag: 'auctions/clive-emson',
    });

    expect(lots.map((l) => l.sourceLotRef)).toEqual(['Lot 1', 'Lot 3']);

    const lot1 = lots[0];
    expect(lot1.sourceHouse).toBe('clive_emson');
    expect(lot1.postcode).toBe('CT9 1AB');
    expect(lot1.guidePriceMinPence).toBe(120_000_00);
    expect(lot1.guidePriceMaxPence).toBe(120_000_00);
    expect(lot1.auctionDate.toISOString().slice(0, 10)).toBe('2026-10-14');
    expect(lot1.lotUrl).toBe('https://www.example-auctions.co.uk/lots/1');
    expect(lot1.propertyType).toBe('terraced_house');

    // Postcode recovered from the address text; "£150k" is £150,000 not £150;
    // an unparseable date falls back to a future default instead of failing.
    const lot3 = lots[1];
    expect(lot3.postcode).toBe('TN1 2XY');
    expect(lot3.guidePriceMinPence).toBe(150_000_00);
    expect(lot3.auctionDate.getTime()).toBeGreaterThan(Date.now());
  });

  it('returns [] when the client returns null', async () => {
    vi.mocked(callClaudeForObject).mockResolvedValue(null);
    await expect(
      extractLotsFromHtml({
        html: CATALOGUE_HTML,
        pageUrl: PAGE_URL,
        sourceHouse: 'savills',
        tag: 'auctions/savills',
      })
    ).resolves.toEqual([]);
  });

  it('does not call the model for a near-empty page', async () => {
    await extractLotsFromHtml({
      html: '<html><body><p>Coming soon</p></body></html>',
      pageUrl: PAGE_URL,
      sourceHouse: 'savills',
      tag: 'auctions/savills',
    });
    expect(callClaudeForObject).not.toHaveBeenCalled();
  });
});
