import { describe, expect, it } from 'vitest';
import {
  findBannedPhrases,
  KEPT_AGENT_PROPOSITION,
  KEPT_PRICE_EXCEPTIONS,
  KEPT_PROMISE,
  KEPT_SIGN_OFF,
  KEPT_VOICE_RULES,
} from '../brand-voice';

const EM_DASH = '—';

describe('Kept voice block', () => {
  it('carries the live-site promise and nothing faster', () => {
    expect(KEPT_PROMISE).toContain('two working days of viewing');
    expect(KEPT_PROMISE).toContain('binding upon Kept for a week');
    expect(KEPT_PROMISE).toContain('as little as two weeks');
    expect(KEPT_PROMISE).not.toMatch(/24[- ]hour|4[- ]hour|60[- ]second/i);
  });

  it('never shows the model an em dash', () => {
    for (const block of [
      KEPT_VOICE_RULES,
      KEPT_PROMISE,
      KEPT_PRICE_EXCEPTIONS,
      KEPT_AGENT_PROPOSITION,
      KEPT_SIGN_OFF,
    ]) {
      expect(block).not.toContain(EM_DASH);
    }
  });

  it('states the binding rules the Aug 2026 review made', () => {
    expect(KEPT_VOICE_RULES).toContain('honest steer');
    expect(KEPT_VOICE_RULES).toContain('binding upon Kept for a week');
    expect(KEPT_VOICE_RULES).toContain('Numbers in probate copy');
    expect(KEPT_VOICE_RULES).toContain('StepChange');
    expect(KEPT_VOICE_RULES).toContain('no indicative offers');
    expect(KEPT_VOICE_RULES).toContain("who we're wrong for");
  });

  it('signs off without an em dash and with the brand address', () => {
    expect(KEPT_SIGN_OFF).toMatch(/^Sam at .+, .+@.+/);
  });
});

describe('findBannedPhrases', () => {
  it('flags retired SLA figures, banned claims and em dashes', () => {
    const draft = `We buy any house with a 24-hour cash backup ${EM_DASH} guaranteed.`;
    const hits = findBannedPhrases(draft);
    expect(hits).toContain('we buy any house');
    expect(hits).toContain('24-hour');
    expect(hits).toContain('em dash');
  });

  it('passes copy that meets the bar', () => {
    const draft =
      "We view every property. A written offer within two working days of viewing, held for a week. If that's not right for you, we'll say so.";
    expect(findBannedPhrases(draft)).toEqual([]);
  });
});
