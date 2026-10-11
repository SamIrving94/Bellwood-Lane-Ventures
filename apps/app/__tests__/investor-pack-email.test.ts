import { describe, expect, it } from 'vitest';
import { renderPackEmail } from '../lib/investor-pack-email';

const base = {
  investorLabel: 'Acme Capital',
  headline: 'Three-bed terrace in NG7, below market value',
  snippet: 'A solid terrace that needs a kitchen and bathroom.',
  propertyLine: '3 bed · terraced · NG7',
  pricePence: 18_500_000,
  marketValuePence: 22_000_000,
  heroPhotoUrl: 'https://x.public.blob.vercel-storage.com/a.jpg',
  closesAt: new Date('2026-10-24T12:00:00Z'),
  packUrl: 'https://wearekept.co.uk/investors/tok/deals/d1',
};

describe('renderPackEmail', () => {
  it('shows the investor price, market value and close date', () => {
    const e = renderPackEmail(base);
    expect(e.subject).toContain(base.headline);
    expect(e.html).toContain('£185,000');
    expect(e.html).toContain('£220,000 market value');
    expect(e.html).toContain('Saturday 24 October');
    expect(e.html).toContain(base.packUrl);
    expect(e.text).toContain('£185,000');
  });

  it('omits the market value line when it is not above the price', () => {
    const e = renderPackEmail({ ...base, marketValuePence: 18_000_000 });
    expect(e.html).not.toContain('Against £');
  });

  it('escapes investor-supplied text', () => {
    const e = renderPackEmail({ ...base, headline: '<script>x</script>' });
    expect(e.html).not.toContain('<script>');
  });

  it('never contains an em dash', () => {
    const e = renderPackEmail(base);
    expect(e.html).not.toContain('—');
    expect(e.text).not.toContain('—');
  });
});
