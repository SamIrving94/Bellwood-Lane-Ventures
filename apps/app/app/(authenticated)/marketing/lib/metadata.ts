/**
 * Helpers for safely reading the polymorphic `FounderAction.metadata` JSON
 * blob. Marketing crons each write a different shape — these readers normalise
 * the access to keep the renderers type-safe without a runtime parser library.
 */

type Meta = Record<string, unknown>;

export function asMeta(value: unknown): Meta {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Meta;
  }
  return {};
}

export function getString(meta: Meta, key: string): string | undefined {
  const v = meta[key];
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

export function getStringArray(meta: Meta, key: string): string[] {
  const v = meta[key];
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
  return [];
}

export function getObject(meta: Meta, key: string): Meta | undefined {
  const v = meta[key];
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Meta;
  return undefined;
}

export function getObjectArray(meta: Meta, key: string): Meta[] {
  const v = meta[key];
  if (Array.isArray(v)) {
    return v.filter(
      (x): x is Meta => x !== null && typeof x === 'object' && !Array.isArray(x),
    );
  }
  return [];
}

/**
 * Reads `publishNotBefore` as a Date if present + parseable. The compliance
 * gate uses this to enforce the marketing plan §11 30-day anonymisation rule
 * by dimming (not hiding) actions whose publish window is in the future.
 */
export function readPublishNotBefore(meta: Meta): Date | undefined {
  const raw = meta.publishNotBefore;
  if (typeof raw !== 'string' && !(raw instanceof Date)) return undefined;
  const d = new Date(raw as string | Date);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * Reads `publishedAt` from completed marketing actions. The Calendar tab
 * uses this to place chips on the month grid.
 */
export function readPublishedAt(meta: Meta): Date | undefined {
  const raw = meta.publishedAt;
  if (typeof raw !== 'string' && !(raw instanceof Date)) return undefined;
  const d = new Date(raw as string | Date);
  return Number.isNaN(d.getTime()) ? undefined : d;
}
