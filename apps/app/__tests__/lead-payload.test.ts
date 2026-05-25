import { describe, expect, it } from 'vitest';
import {
  type LeadInput,
  formatGBPCompact,
  formatGBPFromPence,
  formatHeadroomPct,
  leadTypeLabel,
  presentLead,
} from '../app/(authenticated)/leads/lead-payload';

const NOW = new Date('2026-05-25T09:00:00Z');

function baseLead(overrides: Partial<LeadInput> = {}): LeadInput {
  return {
    id: 'lead_1',
    address: 'Apartment 220, Ladywell Point, Pilgrims Way',
    postcode: 'M50 1AZ',
    leadType: 'repossession',
    leadScore: 41,
    verdict: 'THIN',
    status: 'new',
    source: 'rightmove',
    sourceTrail: 'rightmove → tier3/manual',
    marketTrend: 'stable',
    estimatedEquityPence: 14_000_000, // £140k prelim estimate
    contactName: null,
    contactPhone: null,
    contactEmail: null,
    rawPayload: null,
    ...overrides,
  };
}

describe('presentLead — the numbers', () => {
  it('reads pence keys verbatim and computes headroom (£ and %)', () => {
    const view = presentLead(
      baseLead({
        rawPayload: { askingPricePence: 8_500_000 }, // £85k
      }),
      { now: NOW }
    );
    expect(view.askingPricePence).toBe(8_500_000);
    expect(view.estimatePence).toBe(14_000_000);
    expect(view.headroomPence).toBe(5_500_000); // £55k
    expect(view.headroomPct).toBeCloseTo(64.7, 1);
  });

  it('treats bare money keys as pounds (×100)', () => {
    const view = presentLead(
      baseLead({
        estimatedEquityPence: null,
        rawPayload: { asking: 85_000, estimate: 140_000 },
      }),
      { now: NOW }
    );
    expect(view.askingPricePence).toBe(8_500_000);
    expect(view.estimatePence).toBe(14_000_000);
  });

  it('parses formatted money strings like "£270,000" and "140k"', () => {
    const view = presentLead(
      baseLead({
        estimatedEquityPence: null,
        rawPayload: { askingPrice: '£270,000', estimate: '305k' },
      }),
      { now: NOW }
    );
    expect(view.askingPricePence).toBe(27_000_000);
    expect(view.estimatePence).toBe(30_500_000);
  });

  it('prefers the estimatedEquityPence column over rawPayload', () => {
    const view = presentLead(
      baseLead({
        estimatedEquityPence: 14_000_000,
        rawPayload: { estimate: 999_999 },
      }),
      { now: NOW }
    );
    expect(view.estimatePence).toBe(14_000_000);
  });

  it('leaves headroom null when asking is missing', () => {
    const view = presentLead(baseLead({ rawPayload: {} }), { now: NOW });
    expect(view.askingPricePence).toBeNull();
    expect(view.headroomPence).toBeNull();
    expect(view.headroomPct).toBeNull();
  });
});

describe('presentLead — source link', () => {
  it('extracts an http(s) source URL and labels it by host', () => {
    const view = presentLead(
      baseLead({
        rawPayload: { sourceUrl: 'https://www.rightmove.co.uk/properties/123' },
      }),
      { now: NOW }
    );
    expect(view.sourceUrl).toBe('https://www.rightmove.co.uk/properties/123');
    expect(view.sourceLabel).toBe('Rightmove');
  });

  it('rejects non-http values', () => {
    const view = presentLead(
      baseLead({ rawPayload: { sourceUrl: 'javascript:alert(1)' } }),
      {
        now: NOW,
      }
    );
    expect(view.sourceUrl).toBeNull();
  });
});

describe('presentLead — relevance summary', () => {
  it('uses an explicit rawPayload signal when present', () => {
    const view = presentLead(
      baseLead({ rawPayload: { leadSignal: 'By Order of Receivers, vacant' } }),
      { now: NOW }
    );
    expect(view.relevanceSummary).toBe('By Order of Receivers, vacant');
  });

  it('falls back to sourceTrail then a leadType sentence', () => {
    expect(
      presentLead(baseLead({ rawPayload: {} }), { now: NOW }).relevanceSummary
    ).toBe('rightmove → tier3/manual');
    const noTrail = presentLead(
      baseLead({ sourceTrail: null, leadType: 'probate', rawPayload: {} }),
      { now: NOW }
    );
    expect(noTrail.relevanceSummary).toMatch(/Probate sale/i);
  });
});

describe('presentLead — property basics & tenure', () => {
  it('reads type, beds and tenure, inferring leasehold from a lease length', () => {
    const view = presentLead(
      baseLead({
        rawPayload: { propertyType: 'flat', beds: 2, leaseYears: 72 },
      }),
      { now: NOW }
    );
    expect(view.propertyType).toBe('flat');
    expect(view.bedrooms).toBe(2);
    expect(view.tenure).toBe('leasehold');
    expect(view.tenureLabel).toBe('Leasehold · 72 yr');
  });

  it('maps FH/LH shorthand', () => {
    expect(
      presentLead(baseLead({ rawPayload: { tenure: 'FH' } }), { now: NOW })
        .tenure
    ).toBe('freehold');
    expect(
      presentLead(baseLead({ rawPayload: { tenure: 'LH' } }), { now: NOW })
        .tenure
    ).toBe('leasehold');
  });
});

describe('presentLead — flags & T-7 auction gate', () => {
  it('raises a T-7 gate (danger) when an auction is < 7 days away', () => {
    const view = presentLead(
      baseLead({ rawPayload: { auctionDate: '28/05/2026' } }),
      { now: NOW }
    );
    const gate = view.flags.find((f) => f.kind === 'gate');
    expect(gate).toBeDefined();
    expect(gate?.tone).toBe('danger');
    expect(gate?.label).toMatch(/T-7 gate/);
  });

  it('shows a normal auction flag (warn) when comfortably > 7 days away', () => {
    const view = presentLead(
      baseLead({ rawPayload: { auctionDate: '16/06/2026' } }),
      { now: NOW }
    );
    expect(
      view.flags.some((f) => f.kind === 'auction' && f.tone === 'warn')
    ).toBe(true);
    expect(view.flags.some((f) => f.kind === 'gate')).toBe(false);
  });

  it('passes through an unparseable auction string with a verify note', () => {
    const view = presentLead(
      baseLead({ rawPayload: { auctionDate: '16–17/06' } }),
      { now: NOW }
    );
    const auction = view.flags.find((f) => f.kind === 'auction');
    expect(auction?.label).toMatch(/verify T-7/i);
  });

  it('flags short leases and cash-buyers-only and vacant', () => {
    const view = presentLead(
      baseLead({
        rawPayload: { leaseYears: 65, cashBuyersOnly: true, vacant: true },
      }),
      { now: NOW }
    );
    expect(
      view.flags.some((f) => f.kind === 'lease' && f.tone === 'danger')
    ).toBe(true);
    expect(view.flags.some((f) => f.kind === 'cash')).toBe(true);
    expect(view.flags.some((f) => f.kind === 'vacant')).toBe(true);
  });
});

describe('presentLead — enrichment state', () => {
  it('is pending when no contact details exist', () => {
    expect(presentLead(baseLead(), { now: NOW }).enrichmentState).toBe(
      'pending'
    );
  });

  it('is enriched once any contact detail is present', () => {
    expect(
      presentLead(baseLead({ contactPhone: '07700900000' }), { now: NOW })
        .enrichmentState
    ).toBe('enriched');
  });

  it('honours an explicit contactQuality score', () => {
    expect(
      presentLead(baseLead({ rawPayload: { contactQuality: 7 } }), { now: NOW })
        .enrichmentState
    ).toBe('enriched');
  });
});

describe('presentLead — robustness', () => {
  it('never throws on garbage rawPayload', () => {
    for (const payload of [
      null,
      undefined,
      'oops',
      42,
      [],
      { nested: { x: 1 } },
    ]) {
      const view = presentLead(baseLead({ rawPayload: payload }), { now: NOW });
      expect(view.address).toBeTruthy();
      expect(view.relevanceSummary).toBeTruthy();
      expect(Array.isArray(view.flags)).toBe(true);
    }
  });
});

describe('formatting helpers', () => {
  it('formats pence as GBP', () => {
    expect(formatGBPFromPence(8_500_000)).toBe('£85,000');
    expect(formatGBPFromPence(null)).toBe('—');
  });

  it('formats compact GBP', () => {
    expect(formatGBPCompact(14_000_000)).toBe('£140k');
    expect(formatGBPCompact(120_000_000)).toBe('£1.2m');
    expect(formatGBPCompact(-5_500_000)).toBe('-£55k');
  });

  it('formats headroom percentage with a sign', () => {
    expect(formatHeadroomPct(64.7)).toBe('+64.7%');
    expect(formatHeadroomPct(-10)).toBe('-10%');
    expect(formatHeadroomPct(null)).toBe('—');
  });

  it('labels lead types', () => {
    expect(leadTypeLabel('chain_break')).toBe('Chain-break');
    expect(leadTypeLabel('something_new')).toBe('Something New');
  });
});
