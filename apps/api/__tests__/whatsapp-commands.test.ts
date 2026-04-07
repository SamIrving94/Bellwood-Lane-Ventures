import { describe, expect, test } from 'vitest';
import {
  calculateStreak,
  formatStreakMessage,
  buildExportChunks,
} from '@repo/whatsapp/commands';

// ─── calculateStreak ────────────────────────────────────────────────────────

describe('calculateStreak', () => {
  const daysAgo = (n: number): Date => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(12, 0, 0, 0);
    return d;
  };

  test('returns 0 for empty entries', () => {
    expect(calculateStreak([])).toBe(0);
  });

  test('returns 1 for entry today only', () => {
    expect(calculateStreak([daysAgo(0)])).toBe(1);
  });

  test('counts consecutive days', () => {
    const dates = [daysAgo(0), daysAgo(1), daysAgo(2)];
    expect(calculateStreak(dates)).toBe(3);
  });

  test('breaks at a gap', () => {
    // Today, yesterday, then skip a day
    const dates = [daysAgo(0), daysAgo(1), daysAgo(3)];
    expect(calculateStreak(dates)).toBe(2);
  });

  test('allows missing today (day not over yet)', () => {
    // No entry today, but yesterday + day before
    const dates = [daysAgo(1), daysAgo(2), daysAgo(3)];
    expect(calculateStreak(dates)).toBe(3);
  });

  test('handles multiple entries on same day', () => {
    const d = daysAgo(0);
    const d2 = new Date(d);
    d2.setHours(d.getHours() + 2);
    const dates = [d, d2, daysAgo(1)];
    expect(calculateStreak(dates)).toBe(2);
  });

  test('handles timezone parameter', () => {
    // Create a date that's midnight UTC — which is still "yesterday" in US Pacific
    const d = new Date();
    d.setUTCHours(1, 0, 0, 0); // 1 AM UTC = still previous day in Pacific

    // This test just ensures no errors with timezone param
    const result = calculateStreak([d], 'America/Los_Angeles');
    expect(result).toBeGreaterThanOrEqual(0);
  });
});

// ─── formatStreakMessage ────────────────────────────────────────────────────

describe('formatStreakMessage', () => {
  test('returns prompt for 0 streak', () => {
    const msg = formatStreakMessage(0);
    expect(msg).toContain('start your streak');
  });

  test('returns 1-day message', () => {
    const msg = formatStreakMessage(1);
    expect(msg).toContain('1-day streak');
  });

  test('returns encouragement for short streak', () => {
    const msg = formatStreakMessage(5);
    expect(msg).toContain('5-day streak');
    expect(msg).toContain('great habit');
  });

  test('returns excited message for week+ streak', () => {
    const msg = formatStreakMessage(14);
    expect(msg).toContain('14-day streak');
    expect(msg).toContain('incredible');
  });

  test('returns legendary message for 30+ streak', () => {
    const msg = formatStreakMessage(45);
    expect(msg).toContain('45-day streak');
    expect(msg).toContain('legend');
  });
});

// ─── buildExportChunks ──────────────────────────────────────────────────────

describe('buildExportChunks', () => {
  const entry = (content: string, daysAgo = 0) => ({
    content,
    createdAt: new Date(Date.now() - daysAgo * 86400000),
  });

  test('returns message for empty entries', () => {
    const chunks = buildExportChunks([]);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain('no journal entries');
  });

  test('returns single chunk for few entries', () => {
    const entries = [entry('Hello world', 0), entry('Another day', 1)];
    const chunks = buildExportChunks(entries);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain('Hello world');
    expect(chunks[0]).toContain('Another day');
  });

  test('splits into multiple chunks for long content', () => {
    // Create entries with long content that exceeds 4000 chars
    const longContent = 'A'.repeat(1500);
    const entries = [
      entry(longContent, 0),
      entry(longContent, 1),
      entry(longContent, 2),
      entry(longContent, 3),
    ];
    const chunks = buildExportChunks(entries);
    expect(chunks.length).toBeGreaterThan(1);

    // Each chunk should be under 4000 chars
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(4100); // Allow small overflow for header
    }
  });

  test('includes date formatting', () => {
    const entries = [entry('Test entry', 0)];
    const chunks = buildExportChunks(entries);
    expect(chunks[0]).toMatch(/📅/);
  });
});
