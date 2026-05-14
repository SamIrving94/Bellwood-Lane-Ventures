'use server';

import { auth } from '@repo/auth/server';
import { database } from '@repo/database';
import { getSourcedPropertiesRaw } from '@repo/property-data/src/propertydata';
import { revalidatePath } from 'next/cache';

const POSTCODE_KEY = 'scouting.targetPostcodes';

// UK postcode-district pattern: 1-2 letters + 1-2 digits + optional letter.
// (We store districts like 'M14', not full postcodes like 'M14 5AB'.)
const POSTCODE_DISTRICT_RE = /^[A-Z]{1,2}\d{1,2}[A-Z]?$/;

function normalisePostcode(raw: string): string | null {
  const trimmed = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (!POSTCODE_DISTRICT_RE.test(trimmed)) return null;
  return trimmed;
}

export async function getTargetPostcodes(): Promise<string[]> {
  const setting = await database.setting.findUnique({
    where: { key: POSTCODE_KEY },
  });
  if (!setting) return [];
  return Array.isArray(setting.value) ? (setting.value as string[]) : [];
}

export async function setTargetPostcodes(postcodesRaw: string[]): Promise<{
  success: boolean;
  postcodes?: string[];
  error?: string;
  rejected?: string[];
}> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: 'Unauthorized' };

  // Normalise + de-dupe + validate
  const seen = new Set<string>();
  const accepted: string[] = [];
  const rejected: string[] = [];
  for (const raw of postcodesRaw) {
    if (!raw.trim()) continue;
    const norm = normalisePostcode(raw);
    if (!norm) {
      rejected.push(raw);
      continue;
    }
    if (!seen.has(norm)) {
      seen.add(norm);
      accepted.push(norm);
    }
  }

  if (accepted.length === 0) {
    return { success: false, error: 'No valid postcodes — provide UK districts like M14, SK4, LS17.', rejected };
  }

  await database.setting.upsert({
    where: { key: POSTCODE_KEY },
    create: { key: POSTCODE_KEY, value: accepted, updatedBy: userId },
    update: { value: accepted, updatedBy: userId },
  });

  revalidatePath('/settings/scouting');
  return { success: true, postcodes: accepted, rejected };
}

/**
 * Diagnostic: hit PropertyData /sourced-properties for a single postcode and
 * return the raw response. Helps founders see WHY a postcode produces 0 leads
 * — too narrow? wrong format? no listings? rate limited?
 */
export async function diagnoseSourcedProperties(postcode: string): Promise<{
  ok: boolean;
  postcode: string;
  status?: number;
  body?: unknown;
  error?: string;
  summary?: string;
}> {
  const { userId } = await auth();
  if (!userId) return { ok: false, postcode, error: 'Unauthorized' };

  const result = await getSourcedPropertiesRaw(postcode);
  if (!result.ok) {
    return { postcode, ok: false, status: result.status, error: result.error };
  }
  const body = result.body as Record<string, unknown> | null;
  const props =
    (body?.result as { properties?: unknown[] } | undefined)?.properties ??
    (body as { properties?: unknown[] })?.properties ??
    null;
  const status = (body as { status?: string } | null)?.status;
  let summary: string;
  if (Array.isArray(props)) {
    summary = `Returned ${props.length} listings (HTTP ${result.status}, status=${status ?? '?'})`;
  } else if (props === null) {
    summary = `Response shape unexpected — keys: ${body ? Object.keys(body).join(', ') : '(empty)'}`;
  } else {
    summary = `Properties field is not an array`;
  }
  return {
    postcode,
    ok: true,
    status: result.status,
    body: result.body,
    summary,
  };
}

export async function triggerScoutingCron(): Promise<{
  success: boolean;
  result?: Record<string, unknown>;
  error?: string;
}> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: 'Unauthorized' };

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return { success: false, error: 'CRON_SECRET not configured' };

  try {
    const res = await fetch('https://bellwood-api.vercel.app/cron/scouting', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cronSecret}` },
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: `Cron returned HTTP ${res.status}` };
    }
    return { success: true, result };
  } catch (err) {
    return { success: false, error: `Failed to reach cron: ${(err as Error).message}` };
  }
}
