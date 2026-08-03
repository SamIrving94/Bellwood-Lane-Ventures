/**
 * The structured viewing report a field partner fills on their phone.
 *
 * Shared between the public form (apps/web/app/viewing/[token]) and the
 * founder dashboard (apps/app deal page) so the two can't drift. Scores are
 * 1 (bad) – 5 (good); the AVM's refurb model consumes the same areas, so a
 * viewing report can later sharpen the refurb estimate.
 */

export type ConditionArea = {
  key: string;
  label: string;
  /** One-line prompt shown under the score picker on the mobile form. */
  hint: string;
};

export const CONDITION_AREAS: ConditionArea[] = [
  {
    key: 'roof',
    label: 'Roof',
    hint: 'Slipped tiles, sagging, flashing, gutters',
  },
  {
    key: 'damp',
    label: 'Damp & mould',
    hint: 'Staining, smell, peeling paper, condensation',
  },
  {
    key: 'structure',
    label: 'Structure',
    hint: 'Cracks wider than a coin, bowing walls, subsidence signs',
  },
  {
    key: 'windows',
    label: 'Windows & doors',
    hint: 'Single glazing, rot, misted units',
  },
  {
    key: 'electrics',
    label: 'Electrics',
    hint: 'Fuse box age, visible wiring, socket count',
  },
  {
    key: 'heating',
    label: 'Heating & plumbing',
    hint: 'Boiler age, radiators, visible leaks',
  },
  {
    key: 'kitchen',
    label: 'Kitchen',
    hint: 'Age, condition, would a buyer keep it?',
  },
  {
    key: 'bathroom',
    label: 'Bathroom',
    hint: 'Age, condition, sealant, ventilation',
  },
  {
    key: 'externals',
    label: 'Garden & externals',
    hint: 'Fences, drives, outbuildings, japanese knotweed',
  },
];

export const VENDOR_MOTIVATION_OPTIONS = [
  { value: 'hot', label: 'Hot — wants it gone, talked timescales' },
  { value: 'warm', label: 'Warm — open, but not in a hurry' },
  { value: 'cold', label: 'Cold — testing the market' },
  { value: 'unknown', label: 'Could not tell / vendor not present' },
] as const;
