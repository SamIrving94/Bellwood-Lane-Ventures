// @vitest-environment node
/**
 * /cron/provider-health end to end, with fetch stubbed per provider and the
 * database faked in memory. Locks down: a dead key raises ONE card, a known
 * outage doesn't nag, recovery closes the card, and no key value is ever
 * stored or returned.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const KEYS = vi.hoisted(() => {
  const keys = {
    EPC_API_TOKEN: 'epc-secret-token-123',
    OS_PLACES_API_KEY: 'os-secret-key-456',
    PROPERTYDATA_API_KEY: 'pd-secret-key-789',
  };
  // propertydata.ts reads its key once at import, so set before any import.
  Object.assign(process.env, keys);
  return keys;
});

type Row = Record<string, unknown>;
const db = vi.hoisted(() => ({
  settings: new Map<string, unknown>(),
  actions: new Map<string, Row>(),
  events: [] as Row[],
}));

vi.mock('@/env', () => ({ env: { CRON_SECRET: 'cron-secret' } }));
vi.mock('../app/cron/_lib/heartbeat', () => ({
  recordCronHeartbeat: vi.fn(async () => undefined),
}));
vi.mock('@repo/database', () => {
  const isOpen = (r: Row) =>
    r.status === 'pending' || r.status === 'in_progress';
  return {
    database: {
      setting: {
        findUnique: async ({ where }: { where: { key: string } }) =>
          db.settings.has(where.key)
            ? { key: where.key, value: db.settings.get(where.key) }
            : null,
        upsert: async ({
          where,
          create,
        }: { where: { key: string }; create: { value: unknown } }) => {
          db.settings.set(where.key, create.value);
        },
      },
      founderAction: {
        upsert: async ({
          where,
          create,
          update,
        }: { where: { dedupKey: string }; create: Row; update: Row }) => {
          const existing = db.actions.get(where.dedupKey);
          db.actions.set(
            where.dedupKey,
            existing
              ? { ...existing, ...update }
              : { status: 'pending', ...create }
          );
        },
        updateMany: async ({
          where,
          data,
        }: { where: { dedupKey: string }; data: Row }) => {
          const row = db.actions.get(where.dedupKey);
          if (row && isOpen(row)) {
            db.actions.set(where.dedupKey, { ...row, ...data });
            return { count: 1 };
          }
          return { count: 0 };
        },
      },
      agentEvent: {
        create: async ({ data }: { data: Row }) => {
          db.events.push(data);
        },
      },
    },
  };
});

const { GET } = await import('../app/cron/provider-health/route');
const { __clearMemoryCache } = await import(
  '@repo/property-data/src/propertydata'
);
const { __resetRateLimiter } = await import(
  '@repo/property-data/src/rate-limiter'
);
const { redactSecrets, cardActionFor } = await import(
  '../app/cron/_lib/provider-health'
);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

let osStatus = 200;
let pdEchoesKey = false;
const fetchMock = vi.fn(async (input: string | URL) => {
  const url = String(input);
  if (url.includes('api.os.uk')) {
    return osStatus === 200
      ? json({ header: { totalresults: 3 }, results: [{}] })
      : json({ error: 'nope' }, osStatus);
  }
  if (url.includes('get-energy-performance-data')) {
    return json({ data: [{ certificateNumber: '1', postcode: 'SW1A 2AA' }] });
  }
  if (url.includes('propertydata.co.uk')) {
    // Some upstreams echo the credential back in an error body.
    if (pdEchoesKey) {
      return new Response(`bad key ${KEYS.PROPERTYDATA_API_KEY}`, {
        status: 403,
      });
    }
    return json({ status: 'success', result: { credits_remaining: 500 } });
  }
  throw new Error(`unexpected fetch ${url}`);
});

const run = () =>
  GET(
    new Request('https://api.test/cron/provider-health', {
      headers: { authorization: 'Bearer cron-secret' },
    })
  );

beforeEach(() => {
  db.settings.clear();
  db.actions.clear();
  db.events.length = 0;
  osStatus = 200;
  pdEchoesKey = false;
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
  __clearMemoryCache();
  __resetRateLimiter();
});

afterEach(() => vi.unstubAllGlobals());

describe('/cron/provider-health', () => {
  test('rejects a request without the cron secret', async () => {
    const res = await GET(new Request('https://api.test/cron/provider-health'));
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('all healthy: one call per provider, logged, no card', async () => {
    const res = await run();
    const body = await res.json();
    expect(body.checks.map((c: Row) => c.status)).toEqual(['ok', 'ok', 'ok']);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(db.events).toHaveLength(1);
    expect(db.events[0]).toMatchObject({
      eventType: 'provider_health',
      count: 0,
    });
    expect(db.actions.size).toBe(0);
  });

  test('a dead OS Places key raises one card with the error', async () => {
    osStatus = 401;
    const body = await (await run()).json();
    expect(body.raised).toEqual(['os-places']);
    const card = db.actions.get('provider-health:os-places');
    expect(card).toMatchObject({ status: 'pending', priority: 'high' });
    expect(String(card?.description)).toContain('OS Places: invalid API key');
    expect(db.events[0]).toMatchObject({ count: 1 });
  });

  test('a known outage does not reopen a card the founder closed', async () => {
    osStatus = 401;
    await run();
    db.actions.set('provider-health:os-places', {
      ...db.actions.get('provider-health:os-places'),
      status: 'dismissed',
    });
    const body = await (await run()).json();
    expect(body.raised).toEqual([]);
    expect(db.actions.get('provider-health:os-places')?.status).toBe(
      'dismissed'
    );
  });

  test('recovery closes the card; a later failure raises it again', async () => {
    osStatus = 401;
    await run();
    osStatus = 200;
    await run();
    expect(db.actions.get('provider-health:os-places')?.status).toBe(
      'completed'
    );
    osStatus = 401;
    const body = await (await run()).json();
    expect(body.raised).toEqual(['os-places']);
    expect(db.actions.get('provider-health:os-places')?.status).toBe('pending');
  });

  test('no key value appears in anything stored or returned', async () => {
    osStatus = 500;
    pdEchoesKey = true;
    const body = await (await run()).json();
    const everything = JSON.stringify({
      body,
      events: db.events,
      actions: [...db.actions.values()],
      settings: [...db.settings.values()],
    });
    expect(body.checks.map((c: Row) => c.status)).toEqual([
      'ok',
      'failing',
      'failing',
    ]);
    for (const secret of Object.values(KEYS)) {
      expect(everything).not.toContain(secret);
    }
  });
});

describe('redactSecrets', () => {
  test('strips configured values and any key= query param', () => {
    expect(
      redactSecrets('failed https://x/?postcode=A&key=abc123 with s3cr3t', [
        's3cr3t',
      ])
    ).toBe('failed https://x/?postcode=A&key=[redacted] with [redacted]');
  });
});

describe('cardActionFor', () => {
  test('raises only on a flip to failing', () => {
    expect(cardActionFor(null, 'failing')).toBe('raise');
    expect(cardActionFor('ok', 'failing')).toBe('raise');
    expect(cardActionFor('failing', 'failing')).toBe('refresh');
    expect(cardActionFor('failing', 'ok')).toBe('resolve');
  });
});
