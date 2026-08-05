/**
 * Canonical conveyancing checklist for a chain-free cash purchase.
 *
 * Seeded onto a Deal the moment it goes `under_offer` (see
 * apps/app/app/actions/deals/update-status.ts) and driven by the legal-chaser
 * cron. The step keys are the contract — LegalStep rows are unique per
 * (dealId, stepKey), so re-seeding is idempotent.
 *
 * `targetDay` is the working assumption for a chain-free cash purchase
 * anchored to an Orbital-powered panel firm (see
 * docs/architecture/legal-orbital.md): offset in days from instruction, used
 * by the chaser to decide when a step is late. These are INTERNAL ops
 * targets — never quote them to vendors (live-site promises win).
 */

export type LegalStepTemplate = {
  key: string;
  label: string;
  /** Days from instruction by which this step should be done. */
  targetDay: number;
  /** Who moves it: us or the panel firm. Chasers only nag the firm's steps. */
  owner: 'bellwood' | 'solicitor';
};

export const LEGAL_STEPS: LegalStepTemplate[] = [
  {
    key: 'instruct_solicitor',
    label: 'Instruct panel solicitor',
    targetDay: 1,
    owner: 'bellwood',
  },
  {
    key: 'aml_source_of_funds',
    label: 'AML / ID / source of funds cleared',
    targetDay: 3,
    owner: 'bellwood',
  },
  {
    key: 'searches_ordered',
    label: 'Searches ordered (day one, not week three)',
    targetDay: 2,
    owner: 'solicitor',
  },
  {
    key: 'contract_pack_received',
    label: 'Contract pack received from vendor side',
    targetDay: 7,
    owner: 'solicitor',
  },
  {
    key: 'title_reviewed',
    label: 'Title + contract pack reviewed',
    targetDay: 10,
    owner: 'solicitor',
  },
  {
    key: 'enquiries_raised',
    label: 'Enquiries raised',
    targetDay: 12,
    owner: 'solicitor',
  },
  {
    key: 'searches_returned',
    label: 'Searches returned',
    targetDay: 25,
    owner: 'solicitor',
  },
  {
    key: 'enquiries_answered',
    label: 'Enquiries answered',
    targetDay: 28,
    owner: 'solicitor',
  },
  {
    key: 'report_on_title',
    label: 'Report on title issued',
    targetDay: 32,
    owner: 'solicitor',
  },
  {
    key: 'exchange',
    label: 'Exchange of contracts',
    targetDay: 38,
    owner: 'solicitor',
  },
  { key: 'completion', label: 'Completion', targetDay: 45, owner: 'solicitor' },
  {
    key: 'sdlt_and_registration',
    label: 'SDLT paid + HMLR registration lodged',
    targetDay: 55,
    owner: 'solicitor',
  },
];

/** Lookup by key, for rendering labels on the dashboard. */
export const LEGAL_STEP_BY_KEY: Record<string, LegalStepTemplate> =
  Object.fromEntries(LEGAL_STEPS.map((s) => [s.key, s]));
