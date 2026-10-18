/**
 * Real address pairs from prod (Oct 2026 golden-set run). Left: the lead's
 * `preciseAddress` as PropertyData writes it. Right: how the EPC register
 * writes the SAME home (checked by hand against the register, same postcode).
 *
 * Before this file, 126 of 165 golden-set leads came back "unparseable" or
 * "no match". Most were flats in named blocks, which PropertyData writes in
 * shapes the parser had never seen: "BUTLER COURT FLAT 16, HYDE LANE",
 * "FLAT FLAT 29", "WOODFORD COURT 33, …" (block name glued to the street
 * number), "39, THE PIPER BUILDING, …" (flat number first, no "Flat").
 *
 * The negatives matter as much: every fix here must still refuse the wrong
 * flat, the wrong block, and a street with no home in it.
 */

import { describe, expect, it } from 'vitest';
import { addressKey, sameHome } from '../uprn';

// [lead (PropertyData), same home on the EPC register]
const SAME_HOME: [string, string][] = [
  // Block name, then "FLAT n" (sometimes "FLAT FLAT n"), then the street.
  [
    'BUTLER COURT FLAT 16, HYDE LANE, LONDON, SW11 3EX',
    '16 Butler Court, Hyde Lane',
  ],
  [
    'VICARAGE COURT FLAT FLAT 21, VICARAGE GATE, LONDON, W8 4HE',
    'Flat 21, Vicarage Court, Vicarage Gate',
  ],
  [
    'DU CANE COURT FLAT FLAT A54, BALHAM HIGH ROAD, LONDON, SW17 7JB',
    'Flat A54, Du Cane Court, Balham High Road',
  ],
  [
    'RALPH COURT FLAT FLAT 65, QUEENSWAY, LONDON, W2 5HT',
    'Flat 65, Ralph Court, Queensway',
  ],
  [
    'RALPH COURT FLAT FLAT 65, QUEENSWAY, LONDON, W2 5HT',
    'Flat 65 Ralph Court, Queensway',
  ],
  [
    'INVER COURT FLAT 3, INVERNESS TERRACE, LONDON, W2 6JB',
    'Flat 3 Inver Court, Inverness Terrace',
  ],
  [
    'INGLEDEW COURT FLAT 12, HARROGATE ROAD, MOORTOWN, LEEDS, LS17 8TP',
    '12 Ingledew Court',
  ],
  // Block name glued to the block's street number: "WOODFORD COURT 33, …".
  [
    "FLAT 89, WOODFORD COURT 33, SHEPHERD'S BUSH GREEN, LONDON, W12 8QZ",
    'Flat 89, Woodford Court, 33 Shepherds Bush Green',
  ],
  [
    'FLAT 58, CROMPTON COURT 276, BROMPTON ROAD, LONDON, SW3 2AR',
    'FLAT 58, CROMPTON COURT, BROMPTON ROAD',
  ],
  [
    'FLAT 22, CAMBRIDGE MILL 5, CAMBRIDGE STREET, MANCHESTER, M1 5GF',
    'Flat 22, Cambridge Mill, 5 Cambridge Street',
  ],
  [
    'FLAT 1503, BIRCH HOUSE 1, PEGLER SQUARE, KIDBROOKE, SE3 9GL',
    'Flat 1503, Birch House, 1 Pegler Square',
  ],
  [
    'FLAT 1503, BIRCH HOUSE 1, PEGLER SQUARE, KIDBROOKE, SE3 9GL',
    '1503 Birch House, 1, Pegler Square',
  ],
  [
    'APARTMENT 34, THACKRAH COURT 1, SQUIRREL WAY, SHADWELL, LEEDS, LS17 8FQ',
    'Apartment 34, Thackrah Court',
  ],
  [
    'APARTMENT 34, THACKRAH COURT 1, SQUIRREL WAY, SHADWELL, LEEDS, LS17 8FQ',
    'Apartment 34 Thackrah Court, 1, Squirrel Way',
  ],
  // Flat number first with no "Flat", then the block.
  [
    '27, RADCLIFFE HOUSE 401, ASHTON OLD ROAD, MANCHESTER, M11 2DJ',
    'Apartment 27, Radcliffe House, 401 Ashton Old Road',
  ],
  [
    '19, JAEGER HOUSE 6, THURSTAN STREET, LONDON, SW6 2GF',
    '19 Jaeger House, 6 Thurstan Street',
  ],
  [
    '67, MACEY HOUSE 40, SURREY LANE, LONDON, SW11 3PS',
    'Flat 67, MacEy House, 40 Surrey Lane',
  ],
  [
    '20, HITHERLANDS 25, LITTLE DIMOCKS, LONDON, SW12 9JN',
    'Flat 20, Hitherlands, 25 Little Dimocks',
  ],
  [
    '49, RAVENSBOURNE APARTMENTS 5, CENTRAL AVENUE, LONDON, SW6 2GN',
    '49 Ravensbourne Apartments, 5 Central Avenue',
  ],
  [
    '39, THE PIPER BUILDING, PETERBOROUGH ROAD, LONDON, SW6 3EF',
    'Flat 39, The Piper Building, Peterborough Road',
  ],
  [
    '42, BARTON HOUSE, WANDSWORTH BRIDGE ROAD, LONDON, SW6 2PD',
    'Flat 42 Barton House, Wandsworth Bridge Road',
  ],
  [
    '15, COBBS HALL, FULHAM PALACE ROAD, LONDON, SW6 6LL',
    '15 Cobbs Hall, Fulham Palace Road',
  ],
  [
    '1, OLDFIELD HOUSE, WEST DRIVE, LONDON, SW16 1RT',
    'Flat 1 Oldfield House, West Drive',
  ],
  [
    '79, MONTROSE COURT, LONDON, SW7 2QG',
    'Flat 79, Montrose Court, Princes Gate',
  ],
  // A dotted flat number is one flat, not flat 4 of number 03.
  [
    'FLAT 4.03, THE KNIGHTSBRIDGE APARTMENTS 199, KNIGHTSBRIDGE, LONDON, SW7 1RH',
    'Flat 4.03, The Knightsbridge Apartments, 199 Knightsbridge',
  ],
  // "FLAT FIRST FLOOR" is the first-floor flat, not a house called First Floor.
  [
    'FLAT FIRST FLOOR, 55, ATHELDENE ROAD, LONDON, SW18 3BN',
    'Flat First Floor, 55 Atheldene Road',
  ],
  // Already worked; must keep working.
  [
    '18, DAMERY COURT, BRAMHALL, STOCKPORT, SK7 2JY',
    '18 Damery Court, Bramhall',
  ],
  ['31, WOODVILLE COURT, LIDGETT PARK, LEEDS, LS8 1JA', '31, Woodville Court'],
  ['111, WILLIAM BONNEY ESTATE, LONDON, SW4 7JB', '111 William Bonney Estate'],
  [
    'FLAT 201, 5, PICCADILLY PLACE, MANCHESTER, M1 3BR',
    'Flat 201, 5 Piccadilly Place',
  ],
];

// [lead, a DIFFERENT home the matcher must not take]
const DIFFERENT_HOME: [string, string][] = [
  // Neighbouring flats in the same block.
  [
    'BUTLER COURT FLAT 16, HYDE LANE, LONDON, SW11 3EX',
    '5 Butler Court, Hyde Lane',
  ],
  [
    'BUTLER COURT FLAT 16, HYDE LANE, LONDON, SW11 3EX',
    '16A Butler Court, Hyde Lane',
  ],
  [
    'INGLEDEW COURT FLAT 12, HARROGATE ROAD, MOORTOWN, LEEDS, LS17 8TP',
    '12a Ingledew Court',
  ],
  [
    '39, THE PIPER BUILDING, PETERBOROUGH ROAD, LONDON, SW6 3EF',
    'Flat 2 The Piper Building, Peterborough Road',
  ],
  [
    'FLAT 4.03, THE KNIGHTSBRIDGE APARTMENTS 199, KNIGHTSBRIDGE, LONDON, SW7 1RH',
    'Flat 403, The Knightsbridge Apartments, 199 Knightsbridge',
  ],
  [
    'FLAT 4.03, THE KNIGHTSBRIDGE APARTMENTS 199, KNIGHTSBRIDGE, LONDON, SW7 1RH',
    'Flat 4, The Knightsbridge Apartments, 199 Knightsbridge',
  ],
  // Same flat number, different block on the same road.
  [
    '27, RADCLIFFE HOUSE 401, ASHTON OLD ROAD, MANCHESTER, M11 2DJ',
    'Apartment 27 Campbell House, 403, Ashton Old Road',
  ],
  // Same block name, different street: not proven to be the same home.
  [
    'SENDALL COURT FLAT FLAT 29, WINSTANLEY ROAD, LONDON, SW11 2HE',
    'Flat 29 Sendall Court, Winstanley Estate',
  ],
  // A house number on a road is never a flat in a block called that road.
  ['2 Acacia Road', 'Flat 2, Acacia Road'],
  ['2 Acacia Road', 'Flat 2, 12 Acacia Road'],
  // Floors are not flat numbers.
  [
    'FLAT FIRST FLOOR, 55, ATHELDENE ROAD, LONDON, SW18 3BN',
    'Flat Second Floor, 55 Atheldene Road',
  ],
  [
    'FLAT FIRST FLOOR, 55, ATHELDENE ROAD, LONDON, SW18 3BN',
    '55 Atheldene Road',
  ],
];

describe('real PropertyData addresses match the same home on the EPC register', () => {
  it.each(SAME_HOME)('%s  =  %s', (lead, epc) => {
    expect(sameHome(lead, epc)).toBe(true);
  });
});

describe('real PropertyData addresses still refuse a different home', () => {
  it.each(DIFFERENT_HOME)('%s  ≠  %s', (lead, other) => {
    expect(sameHome(lead, other)).toBe(false);
  });
});

describe('addressKey reads the PropertyData block shapes', () => {
  it('"BUTLER COURT FLAT 16, HYDE LANE": flat 16 in Butler Court on Hyde Lane', () => {
    const k = addressKey('BUTLER COURT FLAT 16, HYDE LANE, LONDON, SW11 3EX');
    expect(k.unit).toBe('FLAT:16');
    expect(k.designator).toEqual({ kind: 'name', token: 'BUTLER COURT' });
    expect(k.street).toBe('HYDE LANE');
  });

  it('"FLAT FLAT 29": one flat word too many, still flat 29', () => {
    expect(
      addressKey('SENDALL COURT FLAT FLAT 29, WINSTANLEY ROAD, LONDON').unit
    ).toBe('FLAT:29');
  });

  it('"WOODFORD COURT 33, …": the 33 belongs to the street, not the block name', () => {
    const k = addressKey("FLAT 89, WOODFORD COURT 33, SHEPHERD'S BUSH GREEN");
    expect(k.designator).toEqual({ kind: 'name', token: 'WOODFORD COURT' });
    expect(k.street).toBe('33 SHEPHERDS BUSH GREEN');
  });

  it('"FLAT FIRST FLOOR": a floor', () => {
    const k = addressKey('FLAT FIRST FLOOR, 55, ATHELDENE ROAD, LONDON');
    expect(k.unit).toBe('FLOOR:FIRST');
    expect(k.designator).toEqual({ kind: 'number', token: '55' });
  });

  it('"FLAT 4.03": one flat id', () => {
    expect(
      addressKey('FLAT 4.03, THE KNIGHTSBRIDGE APARTMENTS 199, KNIGHTSBRIDGE')
        .unit
    ).toBe('FLAT:4.03');
  });

  it('a street with no home in it is still refused', () => {
    for (const a of [
      'Hyde Lane, London',
      'Ecclesall Road, Sheffield S11',
      'Balham High Road, London, SW17',
    ]) {
      expect(addressKey(a).designator).toBeNull();
    }
  });
});
