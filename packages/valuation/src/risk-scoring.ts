/**
 * Risk Scoring Module — 0-100 composite environmental + structural risk
 *
 * Implements Section 3 (Environmental Risk) and Section 4 (Building Characteristics)
 * of the BELA-12 AVM spec.
 *
 * Five environmental factors, each scored 0-10 and mapped to a % discount:
 *   Radon        (BGS categories 1-5)
 *   Coal Mining  (Coal Authority zones)
 *   Knotweed     (proximity bands)
 *   Flood        (EA Zones 1, 2, 3a, 3b)
 *   Noise        (Defra Lden dB bands)
 *
 * Building characteristics:
 *   EPC rating adjustment
 *   Construction material risk
 *   Age / build era adjustment
 *
 * Aggregate environmental discount is capped at 12%.
 * Overall risk score 0-100 maps: 0-15 Green, 16-30 Amber, 31-45 Red, 46+ Black.
 */

import 'server-only';

import type { Epc } from '@repo/property-data';

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

/** BGS GeoIndex radon potential category 1-5 */
export type RadonCategory = 1 | 2 | 3 | 4 | 5;

/** Coal Authority zone classification */
export type CoalMiningZone =
  | 'none'
  | 'historic_low'
  | 'historic_medium'
  | 'active_high';

/** Knotweed proximity to property boundary */
export type KnotweedProximity =
  | 'none'
  | 'within_50m'
  | 'within_20m'
  | 'on_plot';

/** Environment Agency flood zone */
export type FloodZone = 'zone_1' | 'zone_2' | 'zone_3a' | 'zone_3b';

/** Defra Lden noise band */
export type NoiseBand =
  | 'below_55'
  | '55_to_65'
  | '65_to_70'
  | 'above_70'
  | 'airport_above_60';

/** Construction type from EPC or survey */
export type ConstructionType =
  | 'brick_stone'
  | 'timber_post_1990'
  | 'timber_pre_1990'
  | 'prc_concrete'
  | 'steel_bisf'
  | 'mundic'
  | 'system_built'
  | 'unknown';

export interface RiskScoringInput {
  postcode: string;
  epc: Epc;
  // Environmental — caller provides these from external API lookups
  radonCategory?: RadonCategory;
  coalMiningZone?: CoalMiningZone;
  knotweedProximity?: KnotweedProximity;
  floodZone?: FloodZone;
  noiseBand?: NoiseBand;
  // Building
  constructionType?: ConstructionType;
}

// ---------------------------------------------------------------------------
// Factor result types
// ---------------------------------------------------------------------------

export interface FactorScore {
  score: number;        // 0-10
  discountFraction: number;  // e.g. 0.02 = 2%
  flag: boolean;        // true = mandatory pre-RICS flag
  detail: string;
}

export interface EnvironmentalScores {
  radon: FactorScore;
  coalMining: FactorScore;
  knotweed: FactorScore;
  flood: FactorScore;
  noise: FactorScore;
  totalEnvScore: number;       // sum 0-48
  totalEnvDiscount: number;    // capped at 0.12 (12%)
  envBand: 'green' | 'amber' | 'red' | 'black';
}

export interface BuildingCharacteristics {
  epcAdjustment: number;       // fraction (can be positive)
  constructionDiscount: number; // fraction
  ageAdjustment: number;        // fraction (can be positive)
  nonStandardFlag: boolean;
  epcBand: string | null;
  constructionType: ConstructionType;
  buildEra: string | null;
}

export interface RiskScore {
  /** Composite 0-100 score (higher = riskier) */
  composite: number;
  environmental: EnvironmentalScores;
  building: BuildingCharacteristics;
  /** Total discount fraction to apply to point estimate */
  totalDiscountFraction: number;
  /** Flags that must be sent to Counsel before RICS survey */
  preRicsFlags: string[];
}

// ---------------------------------------------------------------------------
// Radon scoring (BGS categories 1-5)
// ---------------------------------------------------------------------------

const RADON_TABLE: Record<RadonCategory, { score: number; discount: number; label: string }> = {
  1: { score: 0, discount: 0,     label: '<1% homes above Action Level' },
  2: { score: 2, discount: 0,     label: '1-3% homes above Action Level' },
  3: { score: 4, discount: 0.005, label: '3-10% homes above Action Level' },
  4: { score: 6, discount: 0.01,  label: '10-30% homes above Action Level' },
  5: { score: 9, discount: 0.02,  label: '>30% homes above Action Level' },
};

function scoreRadon(category: RadonCategory = 1): FactorScore {
  const row = RADON_TABLE[category];
  return {
    score: row.score,
    discountFraction: row.discount,
    flag: false,
    detail: `BGS radon category ${category}: ${row.label}`,
  };
}

// ---------------------------------------------------------------------------
// Coal mining scoring
// ---------------------------------------------------------------------------

const COAL_TABLE: Record<
  CoalMiningZone,
  { score: number; discount: number; flag: boolean; label: string }
> = {
  none:            { score: 0, discount: 0,     flag: false, label: 'Not in a coal mining area' },
  historic_low:    { score: 3, discount: 0.005, flag: false, label: 'Historic mining, low risk (>50m depth)' },
  historic_medium: { score: 6, discount: 0.015, flag: true,  label: 'Historic mining, medium risk' },
  active_high:     { score: 9, discount: 0.03,  flag: true,  label: 'Active / high subsidence risk' },
};

function scoreCoalMining(zone: CoalMiningZone = 'none'): FactorScore {
  const row = COAL_TABLE[zone];
  return {
    score: row.score,
    discountFraction: row.discount,
    flag: row.flag,
    detail: `Coal Authority: ${row.label}`,
  };
}

// ---------------------------------------------------------------------------
// Knotweed scoring
// ---------------------------------------------------------------------------

const KNOTWEED_TABLE: Record<
  KnotweedProximity,
  { score: number; discount: number; flag: boolean; label: string }
> = {
  none:       { score: 0,  discount: 0,     flag: false, label: 'No records within 50m' },
  within_50m: { score: 4,  discount: 0.02,  flag: false, label: 'Records 20-50m from boundary' },
  within_20m: { score: 7,  discount: 0.04,  flag: true,  label: 'Records within 20m of boundary' },
  on_plot:    { score: 10, discount: 0.075, flag: true,  label: 'On-plot confirmed infestation' },
};

function scoreKnotweed(proximity: KnotweedProximity = 'none'): FactorScore {
  const row = KNOTWEED_TABLE[proximity];
  return {
    score: row.score,
    discountFraction: row.discount,
    flag: row.flag,
    detail: `Knotweed: ${row.label}`,
  };
}

// ---------------------------------------------------------------------------
// Flood scoring (EA zones)
// ---------------------------------------------------------------------------

const FLOOD_TABLE: Record<
  FloodZone,
  { score: number; discount: number; flag: boolean; label: string }
> = {
  zone_1:  { score: 0,  discount: 0,     flag: false, label: 'Zone 1 — Low probability (<0.1% annual)' },
  zone_2:  { score: 3,  discount: 0.01,  flag: false, label: 'Zone 2 — Medium probability (0.1-1% annual)' },
  zone_3a: { score: 7,  discount: 0.035, flag: true,  label: 'Zone 3a — High probability (>1% annual)' },
  zone_3b: { score: 10, discount: 0.06,  flag: true,  label: 'Zone 3b — Functional floodplain' },
};

function scoreFlood(zone: FloodZone = 'zone_1'): FactorScore {
  const row = FLOOD_TABLE[zone];
  return {
    score: row.score,
    discountFraction: row.discount,
    flag: row.flag,
    detail: `EA Flood Map: ${row.label}`,
  };
}

// ---------------------------------------------------------------------------
// Noise scoring (Defra Lden)
// ---------------------------------------------------------------------------

const NOISE_TABLE: Record<
  NoiseBand,
  { score: number; discount: number; label: string }
> = {
  below_55:           { score: 0, discount: 0,     label: '<55 dB Lden' },
  '55_to_65':         { score: 2, discount: 0.005, label: '55-65 dB Lden (road/rail)' },
  '65_to_70':         { score: 5, discount: 0.015, label: '65-70 dB Lden (road/rail)' },
  above_70:           { score: 8, discount: 0.03,  label: '>70 dB Lden (road/rail)' },
  airport_above_60:   { score: 7, discount: 0.025, label: '>60 dB Lnight (airport)' },
};

function scoreNoise(band: NoiseBand = 'below_55'): FactorScore {
  const row = NOISE_TABLE[band];
  return {
    score: row.score,
    discountFraction: row.discount,
    flag: false,
    detail: `Defra noise maps: ${row.label}`,
  };
}

// ---------------------------------------------------------------------------
// Environmental aggregate
// ---------------------------------------------------------------------------

function aggregateEnvironmental(
  radon: FactorScore,
  coalMining: FactorScore,
  knotweed: FactorScore,
  flood: FactorScore,
  noise: FactorScore
): Pick<EnvironmentalScores, 'totalEnvScore' | 'totalEnvDiscount' | 'envBand'> {
  const totalEnvScore =
    radon.score + coalMining.score + knotweed.score + flood.score + noise.score;

  const rawDiscount =
    radon.discountFraction +
    coalMining.discountFraction +
    knotweed.discountFraction +
    flood.discountFraction +
    noise.discountFraction;
  const totalEnvDiscount = Math.min(rawDiscount, 0.12);

  let envBand: EnvironmentalScores['envBand'];
  if (totalEnvScore <= 8) envBand = 'green';
  else if (totalEnvScore <= 16) envBand = 'amber';
  else if (totalEnvScore <= 24) envBand = 'red';
  else envBand = 'black';

  return { totalEnvScore, totalEnvDiscount, envBand };
}

// ---------------------------------------------------------------------------
// Building characteristics
// ---------------------------------------------------------------------------

const EPC_ADJUSTMENT: Record<string, number> = {
  A: 0.01,
  B: 0.01,
  C: 0,
  D: 0,
  E: -0.005,
  F: -0.02,
  G: -0.02,
};

const CONSTRUCTION_DISCOUNT: Record<ConstructionType, number> = {
  brick_stone:      0,
  timber_post_1990: 0,
  timber_pre_1990:  0.01,
  prc_concrete:     0.04,
  steel_bisf:       0.035,
  mundic:           0.05,
  system_built:     0.03,
  unknown:          0,
};

const NON_STANDARD: Set<ConstructionType> = new Set([
  'timber_pre_1990',
  'prc_concrete',
  'steel_bisf',
  'mundic',
  'system_built',
]);

const AGE_ERA_ADJUSTMENT: Record<string, number> = {
  'pre-1919':  -0.01,
  '1919-1944': -0.005,
  '1945-1980': 0,
  '1981-2000': 0,
  '2001+':     0.005,
};

function mapConstructionEra(constructionAgeBand: string | null): string | null {
  if (!constructionAgeBand) return null;
  const band = constructionAgeBand.toLowerCase();
  if (band.includes('1919') || band.includes('1929') || band.match(/191\d|190\d|18\d\d/))
    return 'pre-1919';
  if (band.includes('1930') || band.includes('1940') || band.includes('1944'))
    return '1919-1944';
  if (
    band.includes('1950') ||
    band.includes('1960') ||
    band.includes('1970') ||
    band.includes('1966') ||
    band.includes('1975') ||
    band.includes('1982')
  )
    return '1945-1980';
  if (
    band.includes('1983') ||
    band.includes('1990') ||
    band.includes('1991') ||
    band.includes('1995') ||
    band.includes('1996') ||
    band.includes('2000') ||
    band.includes('2002')
  )
    return '1981-2000';
  if (
    band.includes('2003') ||
    band.includes('2006') ||
    band.includes('2007') ||
    band.includes('2011') ||
    band.includes('2012') ||
    band.includes('onwards')
  )
    return '2001+';
  return null;
}

function scoreBuildingCharacteristics(
  epc: Epc,
  constructionTypeInput?: ConstructionType
): BuildingCharacteristics {
  const epcBand = epc.epcRating ?? null;
  const epcAdj = epcBand ? (EPC_ADJUSTMENT[epcBand] ?? 0) : 0;

  // Derive construction type from EPC data if not explicitly provided
  const constructionType: ConstructionType = constructionTypeInput ?? 'unknown';
  const constructionDiscount = CONSTRUCTION_DISCOUNT[constructionType];
  const nonStandardFlag = NON_STANDARD.has(constructionType);

  const buildEra = mapConstructionEra(epc.constructionAgeBand);
  const ageAdj = buildEra ? (AGE_ERA_ADJUSTMENT[buildEra] ?? 0) : 0;

  return {
    epcAdjustment: epcAdj,
    constructionDiscount,
    ageAdjustment: ageAdj,
    nonStandardFlag,
    epcBand,
    constructionType,
    buildEra,
  };
}

// ---------------------------------------------------------------------------
// Pre-RICS flags
// ---------------------------------------------------------------------------

function collectPreRicsFlags(
  env: EnvironmentalScores,
  building: BuildingCharacteristics
): string[] {
  const flags: string[] = [];

  if (env.flood.flag)
    flags.push(`Flood zone flag: ${env.flood.detail}`);
  if (env.knotweed.flag)
    flags.push(`Japanese Knotweed flag: ${env.knotweed.detail}`);
  if (env.coalMining.flag)
    flags.push(`Coal mining flag: ${env.coalMining.detail}`);
  if (building.nonStandardFlag)
    flags.push(
      `Non-standard construction: ${building.constructionType} — structural engineer required`
    );
  if (building.epcBand === 'F' || building.epcBand === 'G')
    flags.push(`EPC band ${building.epcBand} — energy improvement disclosure required`);
  if (env.envBand === 'red' || env.envBand === 'black')
    flags.push(`Environmental risk band: ${env.envBand.toUpperCase()} — escalate to board`);

  return flags;
}

// ---------------------------------------------------------------------------
// Composite 0-100 risk score
// ---------------------------------------------------------------------------

function calcCompositeScore(
  env: EnvironmentalScores,
  building: BuildingCharacteristics
): number {
  // Environmental contribution: max env score = 48, scaled to 0-60 range
  const envContrib = Math.round((env.totalEnvScore / 48) * 60);

  // Building contribution: each 1% of total discount = 4 points, max 40
  const buildingDiscountPct =
    (building.constructionDiscount + Math.max(0, -building.epcAdjustment) + Math.max(0, -building.ageAdjustment)) * 100;
  const buildingContrib = Math.min(Math.round(buildingDiscountPct * 4), 40);

  return Math.min(envContrib + buildingContrib, 100);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function scoreRisk(input: RiskScoringInput): RiskScore {
  const {
    epc,
    radonCategory,
    coalMiningZone,
    knotweedProximity,
    floodZone,
    noiseBand,
    constructionType,
  } = input;

  const radon = scoreRadon(radonCategory);
  const coalMining = scoreCoalMining(coalMiningZone);
  const knotweed = scoreKnotweed(knotweedProximity);
  const flood = scoreFlood(floodZone);
  const noise = scoreNoise(noiseBand);

  const { totalEnvScore, totalEnvDiscount, envBand } = aggregateEnvironmental(
    radon,
    coalMining,
    knotweed,
    flood,
    noise
  );

  const environmental: EnvironmentalScores = {
    radon,
    coalMining,
    knotweed,
    flood,
    noise,
    totalEnvScore,
    totalEnvDiscount,
    envBand,
  };

  const building = scoreBuildingCharacteristics(epc, constructionType);

  const composite = calcCompositeScore(environmental, building);

  const netBuildingAdjustment =
    building.epcAdjustment +
    building.ageAdjustment -
    building.constructionDiscount;

  // Total discount = env discount + construction discount + EPC/age penalties
  const totalDiscountFraction = Math.min(
    totalEnvDiscount +
      building.constructionDiscount +
      Math.max(0, -building.epcAdjustment) +
      Math.max(0, -building.ageAdjustment),
    0.40
  );

  void netBuildingAdjustment; // used in offer-calculation via building fields directly

  const preRicsFlags = collectPreRicsFlags(environmental, building);

  return {
    composite,
    environmental,
    building,
    totalDiscountFraction,
    preRicsFlags,
  };
}
