/**
 * Capital Gains Tax on selling an inherited home — an estimate from the
 * user's own figures and the published rates in ./sources.ts.
 *
 * Deliberately simple and loud about it: no reliefs, no losses, no other
 * gains in the year, one seller (or one estate). Private Residence Relief is
 * ignored because an inherited home the seller never lived in does not get
 * it. The tool shows its working so a solicitor or accountant can check it.
 */

import { formatPounds } from './money';
import {
  CGT_ANNUAL_EXEMPT_PENCE,
  CGT_RATE_BASIC,
  CGT_RATE_HIGHER,
  CGT_RATE_PERSONAL_REPRESENTATIVES,
} from './sources';

export type CgtSeller =
  /** The executors / administrators sell, on behalf of the estate. */
  | 'executors'
  /** A beneficiary sells after the home is transferred to them. */
  | 'beneficiary';

export interface CgtInput {
  salePricePence: number;
  /** Value at the date of death, as agreed for probate. */
  probateValuePence: number;
  /** Selling costs the user will pay (agent/auction fees, legal fees). */
  sellingCostsPence: number;
  seller: CgtSeller;
  /** Beneficiaries only. Basic rate assumes the gain fits in the basic band. */
  beneficiaryRateBand?: 'basic' | 'higher';
  /** False if the allowance is already used, or the executors' window has closed. */
  annualExemptAvailable?: boolean;
}

export interface CgtEstimate {
  gainPence: number;
  allowancePence: number;
  taxableGainPence: number;
  rate: number;
  taxPence: number;
  /** One line per step, ready to show. */
  working: string[];
}

export function estimateInheritedHomeCgt(input: CgtInput): CgtEstimate {
  const gainPence = Math.max(
    0,
    input.salePricePence - input.probateValuePence - input.sellingCostsPence
  );
  const allowancePence =
    input.annualExemptAvailable === false
      ? 0
      : Math.min(gainPence, CGT_ANNUAL_EXEMPT_PENCE);
  const taxableGainPence = gainPence - allowancePence;

  let rate = CGT_RATE_PERSONAL_REPRESENTATIVES;
  if (input.seller === 'beneficiary') {
    rate =
      input.beneficiaryRateBand === 'basic' ? CGT_RATE_BASIC : CGT_RATE_HIGHER;
  }
  const taxPence = Math.round(taxableGainPence * rate);

  const working = [
    `Sale price ${formatPounds(input.salePricePence)} − probate value ${formatPounds(input.probateValuePence)} − selling costs ${formatPounds(input.sellingCostsPence)} = gain ${formatPounds(gainPence)}`,
    `Less annual allowance ${formatPounds(allowancePence)} = taxable ${formatPounds(taxableGainPence)}`,
    `At ${Math.round(rate * 100)}% = ${formatPounds(taxPence)}`,
  ];

  return {
    gainPence,
    allowancePence,
    taxableGainPence,
    rate,
    taxPence,
    working,
  };
}
