import { describe, expect, it } from 'vitest';
import {
  AUCTION_GUIDE_HEADROOM,
  PRIME_DISCOUNT_MIN_RATIO,
  PRIME_MIN_VALUE_PENCE,
  assessPrimeOpportunity,
  classifyAuctionTrack,
  classifyTrack,
  isBlockText,
  isPotentialPrimeCapture,
  outwardCode,
  primeOpportunityForTrack,
  toDistrictSet,
} from '../track';

describe('classifyTrack', () => {
  it('classifies £700k+ values as prime', () => {
    expect(
      classifyTrack({ valuePence: PRIME_MIN_VALUE_PENCE, text: '12 Elm Road' })
    ).toBe('prime');
    expect(
      classifyTrack({ valuePence: 1_200_000_00, text: '4 Cheyne Walk, SW3' })
    ).toBe('prime');
  });

  it('classifies below-threshold values as volume', () => {
    expect(classifyTrack({ valuePence: 250_000_00, text: '9 Mill Lane' })).toBe(
      'volume'
    );
    expect(classifyTrack({ valuePence: null, text: '9 Mill Lane' })).toBe(
      'volume'
    );
  });

  it('block language wins over value', () => {
    expect(
      classifyTrack({
        valuePence: 300_000_00,
        text: 'Block of 6 flats, Lewisham High Street',
      })
    ).toBe('block');
    expect(
      classifyTrack({
        valuePence: 2_000_000_00,
        text: 'Freehold block with 8 self-contained flats',
      })
    ).toBe('block');
  });

  it('detects portfolio and whole-building language', () => {
    expect(isBlockText('Property portfolio of 4 houses')).toBe(true);
    expect(isBlockText('Entire building arranged as 3 maisonettes')).toBe(true);
    expect(isBlockText('6 x flats with vacant possession')).toBe(true);
    expect(isBlockText('Licensed HMO, 7 lettable rooms')).toBe(true);
  });

  it('does NOT flag a single flat or ordinary listings', () => {
    expect(isBlockText('Two bedroom flat, Flat 3, 12 Station Road')).toBe(
      false
    );
    expect(isBlockText('A well presented apartment close to the station')).toBe(
      false
    );
    expect(
      classifyTrack({ valuePence: 180_000_00, text: 'Flat 2, 1 High St' })
    ).toBe('volume');
  });
});

// ── Prime is geographic, and the street can stand in for a missing value ──
//
// These cover the two structural faults that made the prime track fire almost
// never: probate leads carry no value at all, and the £700k floor was
// calibrated for London while the scout only scanned the North.

describe('classifyTrack — geography', () => {
  it('promotes a high-value lead inside a prime London district', () => {
    expect(
      classifyTrack({
        valuePence: 900_000_00,
        postcode: 'SE22 8HP',
        text: '14 Melbourne Grove',
      })
    ).toBe('prime');
  });

  it('does NOT promote the same value outside a prime district', () => {
    // £900k in Stockport is an expensive volume lead. We have no refurb
    // thesis there and nobody to send to view it.
    expect(
      classifyTrack({
        valuePence: 900_000_00,
        postcode: 'SK7 2AB',
        text: '14 Bramhall Lane',
      })
    ).toBe('volume');
  });

  it('falls back to the value test when the postcode is unreadable', () => {
    // A false `volume` silently buries a £1M opportunity, so an unknown
    // location must never be the reason a lead is demoted.
    expect(
      classifyTrack({ valuePence: 900_000_00, postcode: 'not-a-postcode' })
    ).toBe('prime');
    expect(classifyTrack({ valuePence: 900_000_00, postcode: null })).toBe(
      'prime'
    );
  });
});

describe('classifyTrack — the street stands in for a missing value', () => {
  it('promotes a valueless probate lead in an expensive district', () => {
    // This is THE fix. gazette.ts hard-codes estateValuePence: null, so
    // before this every probate notice was structurally incapable of ever
    // being prime, however valuable the house.
    expect(
      classifyTrack({
        valuePence: null,
        postcode: 'N10 3SH',
        areaAvgPence: 1_400_000_00,
        text: '22 Fortis Green',
      })
    ).toBe('prime');
  });

  it('leaves a valueless lead as volume when the street is ordinary', () => {
    expect(
      classifyTrack({
        valuePence: null,
        postcode: 'SE15 4TT',
        areaAvgPence: 420_000_00,
      })
    ).toBe('volume');
  });

  it('never lets the street override a real value that is too low', () => {
    // A £300k flat on a £1.4M street is a flat, not a prime opportunity.
    expect(
      classifyTrack({
        valuePence: 300_000_00,
        postcode: 'N10 3SH',
        areaAvgPence: 1_400_000_00,
      })
    ).toBe('volume');
  });

  it('block language still wins over everything', () => {
    expect(
      classifyTrack({
        valuePence: null,
        postcode: 'N10 3SH',
        areaAvgPence: 1_400_000_00,
        text: 'Freehold block of 6 flats',
      })
    ).toBe('block');
  });
});

describe('classifyTrack — the discounted-prime path', () => {
  it('promotes a below-floor house priced like a project on a prime street', () => {
    // The gold-dust case: the deeper the discount, the LOWER the asking
    // price — so a flat £700k floor buries exactly the deals with the most
    // margin. £600k on a £1.4M street is the refurb-arbitrage thesis with
    // the margin already visible, not a below-prime lead.
    expect(
      classifyTrack({
        valuePence: 600_000_00,
        postcode: 'N10 3SH',
        areaAvgPence: 1_400_000_00,
        text: '22 Fortis Green — in need of full modernisation',
      })
    ).toBe('prime');
  });

  it('still files a cheap flat on that street as volume', () => {
    // Ratio: £580k is 41% of £1.4M — above PRIME_DISCOUNT_MIN_RATIO — so
    // only the flat language keeps this out of the prime book.
    expect(
      classifyTrack({
        valuePence: 580_000_00,
        postcode: 'N10 3SH',
        areaAvgPence: 1_400_000_00,
        text: 'Flat 4, 22 Fortis Green',
      })
    ).toBe('volume');
    expect(
      classifyTrack({
        valuePence: 580_000_00,
        postcode: 'N10 3SH',
        areaAvgPence: 1_400_000_00,
        propertyType: 'apartment',
      })
    ).toBe('volume');
  });

  it('keeps the ratio floor: a price too far below the street is not a house', () => {
    // £300k on a £1.4M street (21%) stays volume — the pinned flat case.
    expect(
      classifyTrack({
        valuePence: Math.round(1_400_000_00 * PRIME_DISCOUNT_MIN_RATIO) - 100,
        postcode: 'N10 3SH',
        areaAvgPence: 1_400_000_00,
      })
    ).toBe('volume');
  });

  it('needs a prime street — an ordinary street does not promote a discount', () => {
    expect(
      classifyTrack({
        valuePence: 300_000_00,
        postcode: 'SE15 4TT',
        areaAvgPence: 500_000_00,
      })
    ).toBe('volume');
  });

  it('never fires outside the prime geography', () => {
    // Same numbers in Stockport: no refurb thesis there, stays volume.
    expect(
      classifyTrack({
        valuePence: 600_000_00,
        postcode: 'SK7 2AB',
        areaAvgPence: 1_400_000_00,
      })
    ).toBe('volume');
  });
});

describe('classifyAuctionTrack — guides are floors, not values', () => {
  it('keeps the nationwide £700k+ prime badge with no geographic demotion', () => {
    // An auction catalogue is a curated distress channel; a £750k guide in
    // Leeds still deserves the founder glance before the sale date.
    expect(
      classifyAuctionTrack({
        guidePriceMaxPence: 750_000_00,
        postcode: 'LS5 3AB',
        text: '14 Abbey View',
      })
    ).toBe('prime');
  });

  it('promotes a near-floor guide inside a prime district', () => {
    // Guides run 10–40% under hammer. £550k guided in Battersea is prime
    // stock at the fall of the gavel — catch it while it can still be bought.
    const guide = Math.ceil(PRIME_MIN_VALUE_PENCE * AUCTION_GUIDE_HEADROOM);
    expect(
      classifyAuctionTrack({
        guidePriceMinPence: guide,
        postcode: 'SW11 3AB',
        text: '9 Lavender Hill',
      })
    ).toBe('prime');
  });

  it('does not extend the headroom outside prime districts', () => {
    expect(
      classifyAuctionTrack({
        guidePriceMinPence: 550_000_00,
        postcode: 'M40 9QR',
        text: '14 Alder Road',
      })
    ).toBe('volume');
  });

  it('does not extend the headroom to flats, and block language still wins', () => {
    expect(
      classifyAuctionTrack({
        guidePriceMinPence: 550_000_00,
        postcode: 'SW11 3AB',
        propertyType: 'flat',
      })
    ).toBe('volume');
    expect(
      classifyAuctionTrack({
        guidePriceMinPence: 300_000_00,
        postcode: 'M40 9QR',
        text: 'Freehold block of 6 flats',
      })
    ).toBe('block');
  });

  it('honours founder-marked prime districts for the headroom', () => {
    const founder = toDistrictSet(['DA12']);
    expect(
      classifyAuctionTrack({
        guidePriceMinPence: 550_000_00,
        postcode: 'DA12 1AA',
        primeDistricts: founder,
      })
    ).toBe('prime');
  });

  it('a lot with no guide at all is volume, not a guess', () => {
    expect(
      classifyAuctionTrack({ postcode: 'SW11 3AB', text: '9 Lavender Hill' })
    ).toBe('volume');
  });
});

describe('isPotentialPrimeCapture — guaranteed shortlist slots', () => {
  it('captures anything already prime/block on free signals', () => {
    expect(
      isPotentialPrimeCapture({ valuePence: 900_000_00, postcode: 'SW11 3AB' })
    ).toBe(true);
    expect(
      isPotentialPrimeCapture({
        valuePence: 250_000_00,
        postcode: 'M40 9QR',
        text: 'Block of 6 flats',
      })
    ).toBe(true);
  });

  it('captures a valueless notice in a prime district — the probate cohort', () => {
    // Provable as prime only after the HMLR area-average lookup, which runs
    // AFTER the shortlist — so it must be captured to survive that long.
    expect(
      isPotentialPrimeCapture({ valuePence: null, postcode: 'N10 3SH' })
    ).toBe(true);
    expect(
      isPotentialPrimeCapture({ valuePence: null, postcode: 'SK7 2AB' })
    ).toBe(false);
  });

  it('captures a house-shaped below-floor price in a prime district', () => {
    expect(
      isPotentialPrimeCapture({
        valuePence: 550_000_00,
        postcode: 'SE22 8HP',
        text: '14 Melbourne Grove — requires modernisation',
      })
    ).toBe(true);
    // But not a flat, and not a price below even the discounted floor.
    expect(
      isPotentialPrimeCapture({
        valuePence: 550_000_00,
        postcode: 'SE22 8HP',
        propertyType: 'flat',
      })
    ).toBe(false);
    expect(
      isPotentialPrimeCapture({
        valuePence: 150_000_00,
        postcode: 'SE22 8HP',
      })
    ).toBe(false);
    // Tightened 27 Aug 2026 (founder: "much tighter") — a mid-market house
    // price in a prime district is no longer a GUARANTEED slot. 0.4 of the
    // floor (£280k) captured ~every house in the SW seeds (232 in one day);
    // the capture bar is now 0.75 of the floor (£525k). These leads still
    // compete for the volume shortlist and still classify discounted-prime
    // after enrichment against their real street average.
    expect(
      isPotentialPrimeCapture({
        valuePence: 400_000_00,
        postcode: 'SW17 7EW',
        text: '12 Fishponds Road — terraced house',
      })
    ).toBe(false);
    expect(
      isPotentialPrimeCapture({
        valuePence: 300_000_00,
        postcode: 'SW11 5PS',
        text: 'Taybridge Road',
      })
    ).toBe(false);
  });

  it('honours founder-marked districts, and stays out of everything else', () => {
    const founder = toDistrictSet(['DA12']);
    expect(
      isPotentialPrimeCapture({
        valuePence: null,
        postcode: 'DA12 1AA',
        primeDistricts: founder,
      })
    ).toBe(true);
    // An ordinary volume listing in a volume town is never captured.
    expect(
      isPotentialPrimeCapture({ valuePence: 180_000_00, postcode: 'M14 6NW' })
    ).toBe(false);
  });
});

describe('outwardCode', () => {
  it('reads the shapes our sources actually emit', () => {
    expect(outwardCode('SW11 3AB')).toBe('SW11');
    expect(outwardCode('sw113ab')).toBe('SW11');
    expect(outwardCode('N1 9GU')).toBe('N1');
    expect(outwardCode('SE22')).toBe('SE22');
    expect(outwardCode('EC1A 1BB')).toBe('EC1A');
  });

  it('returns null rather than guessing', () => {
    expect(outwardCode('')).toBeNull();
    expect(outwardCode(null)).toBeNull();
    expect(outwardCode('not a postcode')).toBeNull();
  });
});

describe('assessPrimeOpportunity', () => {
  it('flags the thesis: below the street AND needing work', () => {
    const r = assessPrimeOpportunity({
      valuePence: 800_000_00,
      areaAvgPence: 1_100_000_00,
      listingType: 'unmodernised-properties',
    });
    expect(r.isOpportunity).toBe(true);
    expect(r.isRefurbCandidate).toBe(true);
    expect(Math.round((r.discountToArea ?? 0) * 100)).toBe(27);
  });

  it('does not call a discount an opportunity with no condition reason', () => {
    // Cheap with nothing fixable wrong is usually cheap for a reason we
    // cannot fix — a bad plot, a railway, a short lease.
    const r = assessPrimeOpportunity({
      valuePence: 800_000_00,
      areaAvgPence: 1_100_000_00,
      listingType: null,
    });
    expect(r.isOpportunity).toBe(false);
    expect(r.reasons.join(' ')).toMatch(/no condition reason/i);
  });

  it('does not call an at-market refurb an opportunity', () => {
    const r = assessPrimeOpportunity({
      valuePence: 1_080_000_00,
      areaAvgPence: 1_100_000_00,
      listingType: 'unmodernised-properties',
    });
    expect(r.isOpportunity).toBe(false);
    expect(r.isRefurbCandidate).toBe(true);
  });

  it('reads condition from listing text when there is no badge', () => {
    const r = assessPrimeOpportunity({
      valuePence: 700_000_00,
      areaAvgPence: 1_000_000_00,
      text: 'A substantial Victorian terrace in need of full modernisation',
    });
    expect(r.isRefurbCandidate).toBe(true);
    expect(r.isOpportunity).toBe(true);
  });

  it('says so plainly when there is no comparable to measure against', () => {
    const r = assessPrimeOpportunity({
      valuePence: 800_000_00,
      areaAvgPence: null,
    });
    expect(r.discountToArea).toBeNull();
    expect(r.isOpportunity).toBe(false);
    expect(r.reasons.join(' ')).toMatch(/not measurable/i);
  });
});

describe('primeOpportunityForTrack — who gets the thesis applied', () => {
  it('assesses every prime lead, and finds the opportunity when it is there', () => {
    const r = primeOpportunityForTrack({
      track: 'prime',
      postcode: 'SE22 9EL',
      valuePence: 800_000_00,
      areaAvgPence: 1_100_000_00,
      listingType: 'unmodernised-properties',
    });
    expect(r?.isOpportunity).toBe(true);
  });

  it('never assesses volume — a cheap flat on an expensive street is a flat', () => {
    expect(
      primeOpportunityForTrack({
        track: 'volume',
        postcode: 'N10 3SH',
        valuePence: 300_000_00,
        areaAvgPence: 1_400_000_00,
      })
    ).toBeNull();
  });

  it('assesses a block inside a prime district, not outside one', () => {
    const base = {
      track: 'block' as const,
      valuePence: 1_200_000_00,
      areaAvgPence: 1_600_000_00,
      listingType: 'unmodernised-properties',
    };
    expect(
      primeOpportunityForTrack({ ...base, postcode: 'E8 3DR' })
    ).not.toBeNull();
    expect(
      primeOpportunityForTrack({ ...base, postcode: 'SK7 2AB' })
    ).toBeNull();
  });
});

describe('founder-marked prime districts extend the geography', () => {
  it('promotes a high-value lead in a founder district the built-in list lacks', () => {
    // The DA12 case: the founder marks Gravesend as a prime area. Before
    // this, the scout scanned it daily while the classifier filed every
    // lead as volume — the founder said "prime" and the code said no.
    const founder = toDistrictSet(['DA12']);
    expect(
      classifyTrack({
        valuePence: 750_000_00,
        postcode: 'DA12 1AA',
        primeDistricts: founder,
      })
    ).toBe('prime');
    // Same lead without the founder's choice: volume, as before.
    expect(
      classifyTrack({ valuePence: 750_000_00, postcode: 'DA12 1AA' })
    ).toBe('volume');
  });

  it('lets the street fallback work inside a founder district too', () => {
    const founder = toDistrictSet(['SE13']);
    expect(
      classifyTrack({
        valuePence: null,
        postcode: 'SE13 5EY',
        areaAvgPence: 800_000_00,
        primeDistricts: founder,
      })
    ).toBe('prime');
  });

  it('assesses the opportunity for a block in a founder district', () => {
    const founder = toDistrictSet(['DA12']);
    const r = primeOpportunityForTrack({
      track: 'block',
      postcode: 'DA12 1AA',
      valuePence: 900_000_00,
      areaAvgPence: 1_300_000_00,
      listingType: 'unmodernised-properties',
      primeDistricts: founder,
    });
    expect(r?.isOpportunity).toBe(true);
  });

  it('toDistrictSet normalises case and spacing, and drops garbage', () => {
    const set = toDistrictSet([' da12 ', 'se13', 'not a district', '']);
    expect(set.has('DA12')).toBe(true);
    expect(set.has('SE13')).toBe(true);
    expect(set.size).toBe(2);
  });
});
