import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@repo/ai/claude', () => ({
  CLAUDE_HAIKU: 'claude-haiku-4-5',
  callClaudeForObject: vi.fn(),
}));

import { callClaudeForObject } from '@repo/ai/claude';
import {
  MAX_MOTIVATION_READS_PER_RUN,
  MOTIVATION_FEATURE,
  readListingMotivation,
} from '../motivation-llm';
import {
  MOTIVATION_LEAD_TYPES,
  MOTIVATION_SIGNALS,
  strongerLeadType,
} from '../motivation-signals';
import { DEFAULT_SCORER_CONFIG } from '../scorer-config';

const longText =
  'Offered for sale on behalf of the executors with no onward chain. Cash buyers preferred. In need of full modernisation throughout.';

function candidate(ref: string, summary: string | null = longText) {
  return { ref, address: `${ref} Test Street`, summary };
}

beforeEach(() => {
  vi.mocked(callClaudeForObject).mockReset();
});

describe('readListingMotivation', () => {
  it('reads listings through the routable client, tagged and on Haiku', async () => {
    vi.mocked(callClaudeForObject).mockResolvedValue({
      reads: [
        {
          ref: 'a',
          level: 'strong',
          signals: ['executor_sale', 'no_onward_chain', 'cash_buyers_only'],
          leadType: 'probate',
          evidence: 'on behalf of the executors',
        },
      ],
    } as never);

    const reads = await readListingMotivation([candidate('a')]);

    expect(callClaudeForObject).toHaveBeenCalledTimes(1);
    const call = vi.mocked(callClaudeForObject).mock.calls[0][0];
    expect(call.feature).toBe(MOTIVATION_FEATURE);
    expect(call.feature).toBe('listing_motivation_read');
    expect(call.model).toBe('claude-haiku-4-5');
    expect(call.user).toContain('ref: a');
    expect(call.user).toContain('on behalf of the executors');
    expect(reads.get('a')).toEqual({
      level: 'strong',
      signals: ['executor_sale', 'no_onward_chain', 'cash_buyers_only'],
      leadType: 'probate',
      evidence: 'on behalf of the executors',
    });
  });

  it('skips listings without a real description — absence is not evidence', async () => {
    vi.mocked(callClaudeForObject).mockResolvedValue({ reads: [] } as never);
    const reads = await readListingMotivation([
      candidate('short', 'Two bed flat.'),
      candidate('none', null),
    ]);
    expect(callClaudeForObject).not.toHaveBeenCalled();
    expect(reads.size).toBe(0);
  });

  it('ignores refs the model invents and keeps the first read per ref', async () => {
    vi.mocked(callClaudeForObject).mockResolvedValue({
      reads: [
        {
          ref: 'ghost',
          level: 'strong',
          signals: ['repossession'],
          leadType: 'repossession',
          evidence: 'x',
        },
        {
          ref: 'a',
          level: 'some',
          signals: ['no_onward_chain'],
          leadType: null,
          evidence: 'no chain',
        },
        {
          ref: 'a',
          level: 'strong',
          signals: ['executor_sale'],
          leadType: 'probate',
          evidence: 'dup',
        },
      ],
    } as never);
    const reads = await readListingMotivation([candidate('a')]);
    expect(reads.has('ghost')).toBe(false);
    expect(reads.get('a')?.level).toBe('some');
  });

  it('forces level none when the model returns no signals, and drops the lead type', async () => {
    vi.mocked(callClaudeForObject).mockResolvedValue({
      reads: [
        {
          ref: 'a',
          level: 'strong',
          signals: [],
          leadType: 'probate',
          evidence: '',
        },
      ],
    } as never);
    const reads = await readListingMotivation([candidate('a')]);
    expect(reads.get('a')).toEqual({
      level: 'none',
      signals: [],
      leadType: null,
      evidence: '',
    });
  });

  it('returns nothing on a failed call instead of throwing', async () => {
    vi.mocked(callClaudeForObject).mockResolvedValue(null);
    await expect(readListingMotivation([candidate('a')])).resolves.toEqual(
      new Map()
    );
  });

  it('batches 20 per call and stops between waves when told to', async () => {
    vi.mocked(callClaudeForObject).mockResolvedValue({ reads: [] } as never);
    const many = Array.from({ length: 100 }, (_, i) => candidate(`r${i}`));
    let calls = 0;
    await readListingMotivation(many, { shouldStop: () => calls++ > 0 });
    // First wave of 4 batches runs; the stop fires before the second wave.
    expect(callClaudeForObject).toHaveBeenCalledTimes(4);
  });

  it('caps the number of listings read per run', async () => {
    vi.mocked(callClaudeForObject).mockResolvedValue({ reads: [] } as never);
    const many = Array.from(
      { length: MAX_MOTIVATION_READS_PER_RUN + 40 },
      (_, i) => candidate(`r${i}`)
    );
    await readListingMotivation(many);
    expect(callClaudeForObject).toHaveBeenCalledTimes(
      MAX_MOTIVATION_READS_PER_RUN / 20
    );
  });
});

describe('motivation vocabulary', () => {
  it('every proposable lead type is a real scorer key (never silently the fallback)', () => {
    for (const t of MOTIVATION_LEAD_TYPES) {
      expect(DEFAULT_SCORER_CONFIG.leadTypeScores[t]).toBeTypeOf('number');
    }
  });

  it('has a closed, non-empty signal list', () => {
    expect(MOTIVATION_SIGNALS.length).toBeGreaterThan(5);
  });
});

describe('strongerLeadType', () => {
  const scores = DEFAULT_SCORER_CONFIG.leadTypeScores;
  const fallback = DEFAULT_SCORER_CONFIG.leadTypeFallback;

  it('upgrades unknown → probate on a strong executor read', () => {
    expect(
      strongerLeadType(
        'unknown',
        { level: 'strong', leadType: 'probate' },
        scores,
        fallback
      )
    ).toBe('probate');
  });

  it('upgrades chain_break → probate when the text states probate', () => {
    expect(
      strongerLeadType(
        'chain_break',
        { level: 'strong', leadType: 'probate' },
        scores,
        fallback
      )
    ).toBe('probate');
  });

  it('never downgrades', () => {
    expect(
      strongerLeadType(
        'repossession',
        { level: 'strong', leadType: 'chain_break' },
        scores,
        fallback
      )
    ).toBe('repossession');
  });

  it('ignores soft reads', () => {
    expect(
      strongerLeadType(
        'unknown',
        { level: 'some', leadType: 'probate' },
        scores,
        fallback
      )
    ).toBe('unknown');
    expect(
      strongerLeadType(
        'unknown',
        { level: 'strong', leadType: null },
        scores,
        fallback
      )
    ).toBe('unknown');
  });
});
