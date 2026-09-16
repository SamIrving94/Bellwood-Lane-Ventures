import { describe, expect, it } from 'vitest';
import { cleanSecret } from './cron-secret';

describe('cleanSecret', () => {
  it('strips a leading byte order mark', () => {
    expect(cleanSecret('﻿abc123')).toBe('abc123');
  });

  it('trims surrounding whitespace and newlines', () => {
    expect(cleanSecret('  abc123\n')).toBe('abc123');
  });

  it('returns undefined for unset or empty values', () => {
    expect(cleanSecret(undefined)).toBeUndefined();
    expect(cleanSecret('')).toBeUndefined();
    expect(cleanSecret('﻿')).toBeUndefined();
  });

  it('leaves a clean secret untouched', () => {
    expect(cleanSecret('abc123')).toBe('abc123');
  });
});
