'use server';

import { auth } from '@repo/auth/server';
import { database } from '@repo/database';

// Default eval configs based on current hardcoded values
const SEED_CONFIGS = {
  lead_scoring: {
    motivation: 45,
    equity: 30,
    marketTrend: 15,
    contactQuality: 10,
    verdictThresholds: {
      STRONG: 70,
      VIABLE: 50,
      THIN: 30,
    },
    description: 'Default lead scoring weights from scouting package',
  },
  deal_quality: {
    sellerTypeMargins: {
      probate: 0.20,
      chain_break: 0.20,
      short_lease: 0.15,
      repossession: 0.25,
      relocation: 0.20,
      standard: 0.22,
    },
    minMarginPercent: 15,
    maxRiskScore: 80,
    preferredSellerTypes: ['probate', 'chain_break', 'repossession'],
    preferredAreas: [],
    description: 'Default deal quality parameters from valuation package',
  },
  avm_confidence: {
    dataSourceWeights: {
      hmlr_price_paid: 1.0,
      hmlr_hpi: 0.8,
      epc: 0.6,
      os_places: 0.5,
    },
    monthlyAppreciationRate: 0.004,
    typeDiscounts: {
      detached: 1.35,
      'semi-detached': 1.0,
      terraced: 0.85,
      flat: 0.72,
    },
    maxEnvironmentalDiscount: 0.12,
    maxTotalDiscount: 0.40,
    description: 'Default AVM confidence parameters from valuation package',
  },
  outreach_quality: {
    toneGuidelines: {
      estate_agent: 'Professional, direct. Emphasise speed and certainty.',
      probate_solicitor: 'Respectful, empathetic. Emphasise support for executors.',
      vendor_probate: 'Deeply empathetic. Acknowledge their loss. Offer to help.',
      vendor_chain_break: 'Urgent but reassuring. Focus on saving their onward purchase.',
      vendor_repossession: 'Non-judgmental. Focus on practical solutions.',
    },
    maxFollowUps: 3,
    followUpDelayDays: [0, 5, 12],
    description: 'Default outreach quality and tone guidelines',
  },
} as const;

export async function seedEvalConfigs() {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const results: Array<{ evalType: string; version: number; id: string }> = [];

  for (const [evalType, seedData] of Object.entries(SEED_CONFIGS)) {
    const { description, ...config } = seedData;

    // Check if version 1 already exists
    const existing = await database.evalConfig.findUnique({
      where: { evalType_version: { evalType: evalType as any, version: 1 } },
    });

    if (existing) {
      results.push({ evalType, version: 1, id: existing.id });
      continue;
    }

    const created = await database.evalConfig.create({
      data: {
        evalType: evalType as any,
        version: 1,
        config: config as any,
        description,
        activatedAt: new Date(),
        activatedBy: userId,
      },
    });

    results.push({ evalType, version: 1, id: created.id });
  }

  return results;
}
