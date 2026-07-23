import { describe, expect, it } from 'vitest';
import { WHATS_NEW, latestWhatsNew } from '../lib/whats-new';

describe('whats-new release notes', () => {
  it('has at least one entry and latestWhatsNew returns the first', () => {
    expect(WHATS_NEW.length).toBeGreaterThan(0);
    expect(latestWhatsNew()?.id).toBe(WHATS_NEW[0]?.id);
  });

  it('entry ids are unique — a duplicate id would silently never re-show', () => {
    const ids = WHATS_NEW.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('entries are newest-first by date', () => {
    const dates = WHATS_NEW.map((e) => e.date);
    const sorted = [...dates].sort((a, b) => b.localeCompare(a));
    expect(dates).toEqual(sorted);
  });

  it('every entry has display-ready content', () => {
    for (const e of WHATS_NEW) {
      expect(e.id).toMatch(/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/);
      expect(e.title.length).toBeGreaterThan(0);
      expect(e.bullets.length).toBeGreaterThan(0);
      for (const b of e.bullets) {
        expect(b.text.length).toBeGreaterThan(0);
      }
      if (e.cta) {
        expect(e.cta.href.startsWith('/')).toBe(true);
      }
    }
  });
});
