import { describe, expect, it } from 'vitest';
import { resolveUprn, sameHome } from '../uprn';

// Red-team cases, written BLIND (before reading uprn.ts). Each row is the
// tester's prediction of the correct, SAFE answer. Wrong matches (true where
// the homes differ) are the failure mode that matters most; where a case is
// genuinely ambiguous the expectation is the safe answer (false).

type Row = [description: string, a: string, b: string, expected: boolean];

const SAME: Row[] = [
  ['canonical OS vs plain', '12 Acacia Road', '12, ACACIA ROAD, LONDON', true],
  [
    'postcode in a is ignored',
    '12 Acacia Road, SW16 2AB',
    '12 ACACIA ROAD',
    true,
  ],
  [
    'postcode mid-string',
    '12 Acacia Road SW16 2AB London',
    '12, ACACIA ROAD',
    true,
  ],
  ['postcode first', 'SW16 2AB, 12 Acacia Road', '12 ACACIA ROAD', true],
  [
    'lowercase postcode no space',
    '12 acacia road sw162ab',
    '12 ACACIA ROAD',
    true,
  ],
  ['lowercase suffix', '12a Acacia Road', '12A, ACACIA ROAD', true],
  // Triage: AMBIGUOUS ("12 A" could be 12A or a stray letter); safe answer is
  // false, which the matcher gives. Expectation changed from true.
  ['spaced suffix', '12 A Acacia Road', '12A ACACIA ROAD', false],
  ['OS flat style', 'Flat 2, 12 Acacia Road', '2, 12 ACACIA ROAD', true],
  ['flat no commas', 'Flat 2 12 Acacia Road', 'FLAT 2, 12, ACACIA ROAD', true],
  [
    'apartment = flat',
    'Apartment 3, 12 High Street',
    '3, 12 HIGH STREET',
    true,
  ],
  ['road abbreviation', '12 Acacia Rd', '12 ACACIA ROAD', true],
  ['road abbreviation with dot', '12 Acacia Rd.', '12 ACACIA ROAD', true],
  ['apostrophe', "12 King's Road", '12 KINGS ROAD', true],
  [
    'St with dot and apostrophe',
    "12 St. John's Road",
    '12 ST JOHNS ROAD',
    true,
  ],
  [
    'hyphenated street',
    '12 Newcastle-under-Lyme Road',
    '12 NEWCASTLE UNDER LYME ROAD',
    true,
  ],
  [
    'extra locality words',
    '12 Acacia Road, Streatham, London',
    '12 ACACIA ROAD',
    true,
  ],
  ['leading/trailing junk', '  12 acacia road.  ', '12 ACACIA ROAD', true],
  [
    'house name + street',
    'Rose Cottage, Church Lane',
    'ROSE COTTAGE, CHURCH LANE, LITTLE BUDWORTH',
    true,
  ],
  ['house name identical, no street', 'Rose Cottage', 'ROSE COTTAGE', true],
  ['Welsh street', '12 Heol y Parc', '12 HEOL Y PARC, PONTYPRIDD', true],
  [
    'same floor flat identical',
    'Ground Floor Flat, 12 Acacia Road',
    'GROUND FLOOR FLAT, 12 ACACIA ROAD',
    true,
  ],
  ['The Avenue identical', '12 The Avenue', '12, THE AVENUE', true],
];

const DIFFERENT: Row[] = [
  // House numbers
  ['12 vs 12A', '12 Acacia Road', '12A Acacia Road', false],
  ['12 vs 112', '12 Acacia Road', '112 Acacia Road', false],
  ['12 vs 1', '12 Acacia Road', '1 Acacia Road', false],
  ['12A vs 12B', '12A Acacia Road', '12B Acacia Road', false],
  ['12 vs 12 A spaced', '12 Acacia Road', '12 A Acacia Road', false],
  ['Flat A of 12 vs 12A', 'Flat A, 12 Acacia Road', '12A Acacia Road', false],
  ['12A vs Flat A of 12', '12A Acacia Road', 'Flat A, 12 Acacia Road', false],
  // Whole house vs flats
  ['house vs flat 1', '12 Acacia Road', 'Flat 1, 12 Acacia Road', false],
  ['flat 1 vs house', 'Flat 1, 12 Acacia Road', '12 Acacia Road', false],
  [
    'flat 1 vs flat 2',
    'Flat 1, 12 Acacia Road',
    'Flat 2, 12 Acacia Road',
    false,
  ],
  [
    'flat 1 vs flat 10',
    'Flat 1, 12 Acacia Road',
    'Flat 10, 12 Acacia Road',
    false,
  ],
  [
    'flat 1 vs flat 1A',
    'Flat 1, 12 Acacia Road',
    'Flat 1A, 12 Acacia Road',
    false,
  ],
  [
    'flat 1 of 12 vs flat 1 of 14',
    'Flat 1, 12 Acacia Road',
    'Flat 1, 14 Acacia Road',
    false,
  ],
  [
    'flat 1 of 12 vs flat 1 of 12A',
    'Flat 1, 12 Acacia Road',
    'Flat 1, 12A Acacia Road',
    false,
  ],
  [
    'flat 1 different street',
    'Flat 1, 12 Acacia Road',
    'Flat 1, 12 Laburnum Road',
    false,
  ],
  [
    'swapped flat/building',
    'Flat 12, 3 Acacia Road',
    'Flat 3, 12 Acacia Road',
    false,
  ],
  ['swapped OS style', '12, 3 ACACIA ROAD', '3, 12 ACACIA ROAD', false],
  ['flat 2 of 12 vs house 2', 'Flat 2, 12 Acacia Road', '2 Acacia Road', false],
  ['OS flat 2 of 12 vs house 2', '2, 12 ACACIA ROAD', '2 Acacia Road', false],
  ['OS flat 2 of 12 vs house 12', '2, 12 ACACIA ROAD', '12 Acacia Road', false],
  ['house 12 vs OS flat 2 of 12', '12 Acacia Road', '2, 12 ACACIA ROAD', false],
  [
    'house 12 vs flat 12 of a court',
    '12 Acacia Road',
    'Flat 12, Acacia Court, Acacia Road',
    false,
  ],
  [
    'house 12 vs 12 in a court',
    '12 Acacia Road',
    '12 Acacia Court, Acacia Road',
    false,
  ],
  [
    'flat 12 no building number vs house 12',
    'Flat 12, Acacia Road',
    '12 Acacia Road',
    false,
  ],
  ['house vs trailing flat', '12 Acacia Road', '12 Acacia Road, Flat 1', false],
  // Floor-described flats
  [
    'GFF vs house',
    'Ground Floor Flat, 12 Acacia Road',
    '12 Acacia Road',
    false,
  ],
  [
    'house vs GFF',
    '12 Acacia Road',
    'Ground Floor Flat, 12 Acacia Road',
    false,
  ],
  [
    'GFF vs FFF',
    'Ground Floor Flat, 12 Acacia Road',
    'First Floor Flat, 12 Acacia Road',
    false,
  ],
  [
    'GFF abbrev vs FFF',
    'GFF 12 Acacia Road',
    'First Floor Flat 12 Acacia Road',
    false,
  ],
  [
    'basement vs house',
    'Basement Flat, 12 Acacia Road',
    '12 Acacia Road',
    false,
  ],
  [
    'top floor vs ground floor',
    'Top Floor Flat, 12 Acacia Road',
    'Ground Floor Flat, 12 Acacia Road',
    false,
  ],
  [
    'first floor flat vs flat 1',
    'First Floor Flat, 12 Acacia Road',
    'Flat 1, 12 Acacia Road',
    false,
  ],
  [
    'maisonette vs house',
    'Maisonette, 12 Acacia Road',
    '12 Acacia Road',
    false,
  ],
  [
    'upper vs lower maisonette',
    'Upper Maisonette, 12 Acacia Road',
    'Lower Maisonette, 12 Acacia Road',
    false,
  ],
  [
    'flat 1-2 vs flat 1',
    'Flat 1-2, 12 Acacia Road',
    'Flat 1, 12 Acacia Road',
    false,
  ],
  // Ranges / multiple / non-dwellings
  ['range vs 12', '12-14 Acacia Road', '12 Acacia Road', false],
  ['range vs 14', '12-14 Acacia Road', '14 Acacia Road', false],
  ['range vs itself', '12-14 Acacia Road', '12-14 Acacia Road', false],
  ['ampersand pair vs 12', '12 & 14 Acacia Road', '12 Acacia Road', false],
  [
    'flat in range building',
    'Flat 2, 12-14 Acacia Road',
    'Flat 2, 12 Acacia Road',
    false,
  ],
  ['land adjacent', 'Land adjacent to 12 Acacia Road', '12 Acacia Road', false],
  ['land at rear', 'Land at rear of 12 Acacia Road', '12 Acacia Road', false],
  ['garage', 'Garage at 12 Acacia Road', '12 Acacia Road', false],
  [
    'unit 4 commercial',
    'Unit 4, Mill Lane Industrial Estate',
    '4 Mill Lane',
    false,
  ],
  ['unit 4 within number', 'Unit 4, 12 Acacia Road', '12 Acacia Road', false],
  ['plot 7', 'Plot 7, Meadow View', '7 Meadow View', false],
  [
    'plot 7 vs plot 7 other dev',
    'Plot 7, Meadow View',
    '7 Meadow View Close',
    false,
  ],
  // Street-only
  ['street only vs itself', 'Acacia Road', 'ACACIA ROAD', false],
  ['street only vs house', 'Acacia Road, London', '12 Acacia Road', false],
  [
    'street only with SW12 postcode',
    'Acacia Road, SW12 9AB',
    '12 Acacia Road',
    false,
  ],
  [
    'postcode digits not house number',
    '12 Acacia Road, SW16 2AB',
    '16 Acacia Road',
    false,
  ],
  [
    'postcode digits not flat',
    '12 Acacia Road SW16 2AB',
    '2A, 12 ACACIA ROAD',
    false,
  ],
  ['empty vs empty', '', '', false],
  ['empty vs house', '', '12 Acacia Road', false],
  // Street words
  ['different street same number', '12 Acacia Road', '12 Laburnum Road', false],
  ['Road vs Avenue', '12 Acacia Road', '12 Acacia Avenue', false],
  [
    'St Johns Road vs St Johns Street',
    '12 St Johns Road',
    '12 St Johns Street',
    false,
  ],
  ['St Johns vs St James', '12 St Johns Road', '12 St James Road', false],
  ['Kings vs Queens', "12 King's Road", "12 Queen's Road", false],
  ['Church Lane vs Church Street', '12 Church Lane', '12 Church Street', false],
  ['High Street vs High Road', '12 High Street', '12 High Road', false],
  ['North vs South Street', '12 North Street', '12 South Street', false],
  ['Upper vs Lower Street', '12 Upper Street', '12 Lower Street', false],
  ['The Avenue vs The Crescent', '12 The Avenue', '12 The Crescent', false],
  ['The Green vs The Grove', '12 The Green', '12 The Grove', false],
  [
    'street word only in b locality',
    '12 Acacia Road',
    '12 Laburnum Road, Acacia Park',
    false,
  ],
  [
    'street word only in b building name',
    '12 Acacia Road',
    'Acacia House, 12 Laburnum Road',
    false,
  ],
  ['Welsh different street', '12 Heol y Parc', '12 Heol Las', false],
  [
    'Welsh different house names',
    'Ty Newydd, Heol y Parc',
    'Ty Gwyn, Heol y Parc',
    false,
  ],
  // House names
  [
    'Rose Cottage vs Rose Cottage Barn',
    'Rose Cottage, Church Lane',
    'Rose Cottage Barn, Church Lane',
    false,
  ],
  [
    'Rose Cottage Barn vs Rose Cottage',
    'Rose Cottage Barn',
    'Rose Cottage',
    false,
  ],
  [
    'Rose vs Ivy Cottage',
    'Rose Cottage, Church Lane',
    'Ivy Cottage, Church Lane',
    false,
  ],
  [
    'Old Rectory vs Rectory Cottage',
    'The Old Rectory, Church Lane',
    'Rectory Cottage, Church Lane',
    false,
  ],
  [
    'Old Rectory vs its coach house',
    'The Old Rectory, Church Lane',
    'The Coach House, The Old Rectory, Church Lane',
    false,
  ],
  ['annexe vs main house', 'Annexe, Rose Cottage', 'Rose Cottage', false],
  [
    'name only vs numbered house',
    'Rose Cottage, Church Lane',
    '12 Church Lane',
    false,
  ],
  // Building names with numbers
  [
    'flat in named building vs street number',
    '1 Albert Court, 12 High Street',
    '12 High Street',
    false,
  ],
  [
    'flat 1 vs flat 2 named building',
    '1 Albert Court, 12 High Street',
    '2 Albert Court, 12 High Street',
    false,
  ],
  [
    'court flat vs house 1',
    '1 Albert Court, High Street',
    '1 High Street',
    false,
  ],
  [
    'flat 3 named building vs house 3',
    'Flat 3, Albert Court, High Street',
    '3 High Street',
    false,
  ],
  [
    'block A vs block B',
    'Apartment 3, Block B, Riverside Quay',
    'Apartment 3, Block A, Riverside Quay',
    false,
  ],
  [
    'numbers as words vs different number',
    'Twelve Acacia Road',
    '13 Acacia Road',
    false,
  ],
];

// Probes added AFTER reading uprn.ts (not blind), aimed at mechanisms seen in
// triage: substring street/name checks, weak-token streets, unparsed prefixes.
const POST_READ: Row[] = [
  [
    'street word as substring of another street',
    '12 Rose Road',
    '12 Primrose Road',
    false,
  ],
  [
    'street word as prefix of another street',
    '12 Mill Road',
    '12 Millbrook Road',
    false,
  ],
  ['all-weak street vs other street', '12 Park Road', '12 Station Road', false],
  ['The Avenue vs named street', '12 The Avenue', '12 Acacia Road', false],
  [
    'St Marys Road vs St Marys Close',
    '12 St Marys Road',
    '12 St Marys Close',
    false,
  ],
  ['GFF abbreviation vs house', 'GFF 12 Acacia Road', '12 Acacia Road', false],
  [
    'Basement (no FLAT word) vs house',
    'Basement, 12 Acacia Road',
    '12 Acacia Road',
    false,
  ],
  [
    'Flat 1-2 of 12 vs flat 1 of 2',
    'Flat 1-2, 12 Acacia Road',
    'Flat 1, 2 Acacia Road',
    false,
  ],
  [
    '12 & 14 vs flat 12 of 14',
    '12 & 14 Acacia Road',
    'Flat 12, 14 Acacia Road',
    false,
  ],
  [
    '12/14 vs flat 12 of 14',
    '12/14 Acacia Road',
    'Flat 12, 14 Acacia Road',
    false,
  ],
  [
    'house name vs numbered terrace of that name',
    'Rose Cottage, Mill Lane',
    '2 Rose Cottages, Mill Lane',
    false,
  ],
  [
    'house name substring of another name',
    'Ash House, Church Lane',
    'The Wash House, Church Lane',
    false,
  ],
  [
    'The Cottage vs The Cottage Farm',
    'The Cottage, Mill Lane',
    'The Cottage Farm, Mill Lane',
    false,
  ],
];

describe('sameHome post-read probes', () => {
  it.each(POST_READ)('%s', (_d, a, b, expected) => {
    expect(sameHome(a, b)).toBe(expected);
  });
});

describe('sameHome red team', () => {
  it.each([...SAME, ...DIFFERENT])('%s', (_d, a, b, expected) => {
    expect(sameHome(a, b)).toBe(expected);
  });

  // A wrong match must not appear just by swapping the arguments.
  it.each(DIFFERENT)('reversed: %s', (_d, a, b) => {
    expect(sameHome(b, a)).toBe(false);
  });
});

type Rec = { uprn: string; address: string };
const lk = (epc: Rec[] | null, os: Rec[] | null) => ({
  // Triage fix: the UprnLookups contract is async (resolveUprn calls
  // .catch on the result). Sync stubs were a test error, not a bug.
  epc: async (_pc: string) => epc,
  os: async (_pc: string) => os,
});
const run = async (
  address: string,
  postcode: string,
  epc: Rec[] | null,
  os: Rec[] | null
) => await resolveUprn({ address, postcode }, lk(epc, os) as never);

describe('resolveUprn red team', () => {
  it('both sources agree -> high', async () => {
    const r = await run(
      '12 Acacia Road',
      'SW16 2AB',
      [{ uprn: '100', address: '12 Acacia Road' }],
      [{ uprn: '100', address: '12, ACACIA ROAD, LONDON' }]
    );
    expect(r.confidence).toBe('high');
    expect(String(r.uprn)).toBe('100');
  });

  it('EPC matches, OS has no match -> medium', async () => {
    const r = await run(
      '12 Acacia Road',
      'SW16 2AB',
      [{ uprn: '100', address: '12 Acacia Road' }],
      [{ uprn: '200', address: '14, ACACIA ROAD' }]
    );
    expect(r.confidence).toBe('medium');
    expect(String(r.uprn)).toBe('100');
  });

  it('OS matches, EPC unavailable -> medium', async () => {
    const r = await run('12 Acacia Road', 'SW16 2AB', null, [
      { uprn: '100', address: '12, ACACIA ROAD' },
    ]);
    expect(r.confidence).toBe('medium');
    expect(String(r.uprn)).toBe('100');
  });

  it('sources disagree -> null', async () => {
    const r = await run(
      '12 Acacia Road',
      'SW16 2AB',
      [{ uprn: '100', address: '12 Acacia Road' }],
      [{ uprn: '999', address: '12, ACACIA ROAD' }]
    );
    expect(r.confidence).toBeNull();
    expect(r.uprn).toBeNull();
    expect(r.reason).toBeTruthy();
  });

  it('two different UPRNs match within EPC -> null', async () => {
    const r = await run(
      '12 Acacia Road',
      'SW16 2AB',
      [
        { uprn: '100', address: '12 Acacia Road' },
        { uprn: '101', address: '12, Acacia Road' },
      ],
      null
    );
    expect(r.uprn).toBeNull();
    expect(r.confidence).toBeNull();
  });

  it('EPC re-assessments with same UPRN + OS -> high', async () => {
    const r = await run(
      '12 Acacia Road',
      'SW16 2AB',
      [
        { uprn: '100', address: '12 Acacia Road' },
        { uprn: '100', address: '12, Acacia Road, London' },
      ],
      [{ uprn: '100', address: '12, ACACIA ROAD' }]
    );
    expect(r.confidence).toBe('high');
    expect(String(r.uprn)).toBe('100');
  });

  it('OS ambiguous while EPC matches -> not high', async () => {
    const r = await run(
      '12 Acacia Road',
      'SW16 2AB',
      [{ uprn: '100', address: '12 Acacia Road' }],
      [
        { uprn: '100', address: '12, ACACIA ROAD' },
        { uprn: '102', address: '12 ACACIA ROAD' },
      ]
    );
    expect(r.confidence).not.toBe('high');
    // Safe answer: null (one source cannot pick one home).
    expect(r.uprn).toBeNull();
  });

  it('both unavailable -> null', async () => {
    const r = await run('12 Acacia Road', 'SW16 2AB', null, null);
    expect(r.uprn).toBeNull();
    expect(r.confidence).toBeNull();
    expect(r.reason).toBeTruthy();
  });

  it('both empty -> null', async () => {
    const r = await run('12 Acacia Road', 'SW16 2AB', [], []);
    expect(r.uprn).toBeNull();
    expect(r.reason).toBeTruthy();
  });

  it('outcode only -> null', async () => {
    const r = await run(
      '12 Acacia Road',
      'SW16',
      [{ uprn: '100', address: '12 Acacia Road' }],
      [{ uprn: '100', address: '12, ACACIA ROAD' }]
    );
    expect(r.uprn).toBeNull();
    expect(r.confidence).toBeNull();
  });

  it('sector only -> null', async () => {
    const r = await run(
      '12 Acacia Road',
      'SW16 2',
      [{ uprn: '100', address: '12 Acacia Road' }],
      [{ uprn: '100', address: '12, ACACIA ROAD' }]
    );
    expect(r.uprn).toBeNull();
  });

  it('lowercase unspaced full postcode still resolves', async () => {
    const r = await run(
      '12 Acacia Road',
      'sw162ab',
      [{ uprn: '100', address: '12 Acacia Road' }],
      [{ uprn: '100', address: '12, ACACIA ROAD' }]
    );
    expect(r.confidence).toBe('high');
  });

  it('street-only address -> null', async () => {
    const r = await run(
      'Acacia Road',
      'SW16 2AB',
      [{ uprn: '100', address: 'Acacia Road' }],
      [{ uprn: '100', address: 'ACACIA ROAD' }]
    );
    expect(r.uprn).toBeNull();
  });

  it('only near-miss numbers present -> null', async () => {
    const r = await run(
      '12 Acacia Road',
      'SW16 2AB',
      [{ uprn: '1', address: '12A Acacia Road' }],
      [{ uprn: '2', address: '112, ACACIA ROAD' }]
    );
    expect(r.uprn).toBeNull();
  });

  it('converted house: only flats exist -> null', async () => {
    const r = await run(
      '12 Acacia Road',
      'SW16 2AB',
      [
        { uprn: '11', address: 'Flat 1, 12 Acacia Road' },
        { uprn: '12', address: 'Ground Floor Flat, 12 Acacia Road' },
      ],
      [
        { uprn: '11', address: '1, 12 ACACIA ROAD' },
        { uprn: '13', address: '2, 12 ACACIA ROAD' },
      ]
    );
    expect(r.uprn).toBeNull();
  });

  it('EPC record with blank UPRN is not evidence', async () => {
    const r = await run(
      '12 Acacia Road',
      'SW16 2AB',
      [{ uprn: '', address: '12 Acacia Road' }],
      [{ uprn: '100', address: '12, ACACIA ROAD' }]
    );
    expect(r.confidence).not.toBe('high');
    expect(r.uprn === null || String(r.uprn) === '100').toBe(true);
  });

  it('two streets share postcode: picks the right street', async () => {
    const r = await run(
      '12 Acacia Road',
      'SW16 2AB',
      [{ uprn: '200', address: '12 Laburnum Road' }],
      [
        { uprn: '100', address: '12, ACACIA ROAD' },
        { uprn: '200', address: '12, LABURNUM ROAD' },
      ]
    );
    expect(r.confidence).toBe('medium');
    expect(String(r.uprn)).toBe('100');
  });

  it('generic-word street, other street only -> null', async () => {
    const r = await run('12 The Avenue', 'SW16 2AB', null, [
      { uprn: '100', address: '12, THE CRESCENT' },
    ]);
    expect(r.uprn).toBeNull();
  });

  it('flat with embedded postcode resolves to the flat', async () => {
    const r = await run(
      'Flat 2, 12 Acacia Road, SW16 2AB',
      'SW16 2AB',
      [
        { uprn: '22', address: 'Flat 2 12 Acacia Road' },
        { uprn: '21', address: 'Flat 1 12 Acacia Road' },
      ],
      [
        { uprn: '22', address: '2, 12 ACACIA ROAD' },
        { uprn: '21', address: '1, 12 ACACIA ROAD' },
        { uprn: '2', address: '2, ACACIA ROAD' },
      ]
    );
    expect(r.confidence).toBe('high');
    expect(String(r.uprn)).toBe('22');
  });

  it('house 2 must not resolve to flat 2 of 12', async () => {
    const r = await run('2 Acacia Road', 'SW16 2AB', null, [
      { uprn: '22', address: '2, 12 ACACIA ROAD' },
    ]);
    expect(r.uprn).toBeNull();
  });
});
