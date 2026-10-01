import { createHash, randomBytes } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.PLUGIN_AUTH_SECRET =
  'test-secret-that-is-at-least-32-characters-long';
process.env.PLUGIN_PUBLIC_URL = 'https://plugin.test';

const sent: Array<{ to: string; subject: string; text?: string }> = [];

vi.mock('@repo/database', async () => ({
  database: (await import('./fake-db')).fakeDatabase,
}));
vi.mock('@repo/email', () => ({
  sendEmail: vi.fn(
    async (e: { to: string; subject: string; text?: string }) => {
      sent.push(e);
      return { id: 'x' };
    }
  ),
}));

import { GET as asMeta } from '@/app/.well-known/oauth-authorization-server/route';
import { GET as prMeta } from '@/app/.well-known/oauth-protected-resource/pro/mcp/route';
import {
  GET as authorizeGet,
  POST as authorizePost,
} from '@/app/oauth/authorize/route';
import { POST as register } from '@/app/oauth/register/route';
import { POST as token } from '@/app/oauth/token/route';
import { POST as proMcp } from '@/app/pro/mcp/route';
import { resetStore, store } from './fake-db';
import { rpc } from './mcp-client';

const BASE = 'https://plugin.test';
const REDIRECT = 'https://chatgpt.com/connector_platform_oauth_redirect';

function pkce() {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

function hidden(html: string, name: string): string {
  const m = html.match(new RegExp(`name="${name}" value="([^"]+)"`));
  if (!m?.[1]) throw new Error(`no hidden ${name}`);
  return m[1].replace(/&amp;/g, '&');
}

function form(data: Record<string, string>) {
  return new Request(`${BASE}/oauth/authorize`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      origin: BASE,
    },
    body: new URLSearchParams(data).toString(),
  });
}

async function registerClient(): Promise<string> {
  const res = await register(
    new Request(`${BASE}/oauth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        redirect_uris: [REDIRECT],
        client_name: 'ChatGPT',
      }),
    })
  );
  expect(res.status).toBe(201);
  return (await res.json()).client_id;
}

/** Full sign-in for an email; returns the token response. */
async function signIn(email: string, scope = 'agent investor') {
  const clientId = await registerClient();
  const { verifier, challenge } = pkce();
  const q = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: REDIRECT,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state: 'xyz',
    scope,
    resource: `${BASE}/pro/mcp`,
  });
  const page = await authorizeGet(new Request(`${BASE}/oauth/authorize?${q}`));
  expect(page.status).toBe(200);
  expect(page.headers.get('x-frame-options')).toBe('DENY');
  const req = hidden(await page.text(), 'req');

  sent.length = 0;
  const codePage = await authorizePost(form({ step: 'email', req, email }));
  const pending = hidden(await codePage.text(), 'pending');
  const code = sent[0]?.subject.match(/(\d{6})$/)?.[1];
  if (!code) throw new Error('no code emailed');

  const done = await authorizePost(form({ step: 'code', pending, code }));
  expect(done.status).toBe(302);
  const location = new URL(done.headers.get('location') as string);
  expect(location.origin + location.pathname).toBe(REDIRECT);
  expect(location.searchParams.get('state')).toBe('xyz');
  expect(location.searchParams.get('iss')).toBe(BASE);

  const authCode = location.searchParams.get('code') as string;
  const res = await token(
    new Request(`${BASE}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: authCode,
        redirect_uri: REDIRECT,
        client_id: clientId,
        code_verifier: verifier,
      }).toString(),
    })
  );
  const body = await res.json();
  return { status: res.status, body, authCode, clientId, verifier };
}

const bearer = (t: string) => ({ authorization: `Bearer ${t}` });

beforeEach(() => {
  resetStore();
  sent.length = 0;
});

describe('discovery', () => {
  it('advertises the authorization server with PKCE S256 and CIMD', async () => {
    const m = await (
      await asMeta(
        new Request(`${BASE}/.well-known/oauth-authorization-server`)
      )
    ).json();
    expect(m.issuer).toBe(BASE);
    expect(m.code_challenge_methods_supported).toEqual(['S256']);
    expect(m.client_id_metadata_document_supported).toBe(true);
  });

  it('serves protected resource metadata for /pro/mcp', async () => {
    const m = await (
      await prMeta(
        new Request(`${BASE}/.well-known/oauth-protected-resource/pro/mcp`)
      )
    ).json();
    expect(m.resource).toBe(`${BASE}/pro/mcp`);
    expect(m.authorization_servers).toEqual([BASE]);
  });

  it('answers an unauthenticated MCP call with 401 and the metadata pointer', async () => {
    const r = await rpc(proMcp, 'tools/list');
    expect(r.status).toBe(401);
    expect(r.headers.get('www-authenticate')).toContain(
      'oauth-protected-resource/pro/mcp'
    );
  });
});

describe('sign-in', () => {
  it('signs in a partner agent end to end and lists the Pro tools', async () => {
    const { status, body } = await signIn('Agent@Firm.co.uk');
    expect(status).toBe(200);
    expect(body.scope).toBe('agent');
    const list = await rpc(proMcp, 'tools/list', {}, bearer(body.access_token));
    expect(list.status).toBe(200);
    const names = list.body.result.tools
      .map((t: { name: string }) => t.name)
      .sort();
    expect(names).toEqual([
      'kept_released_deals',
      'my_kept_referrals',
      'refer_sale_to_kept',
      'register_interest_in_deal',
    ]);
  });

  it('never emails an unknown address, and no code can work for it', async () => {
    const clientId = await registerClient();
    const { challenge } = pkce();
    const q = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: REDIRECT,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });
    const req = hidden(
      await (
        await authorizeGet(new Request(`${BASE}/oauth/authorize?${q}`))
      ).text(),
      'req'
    );
    const page = await authorizePost(
      form({ step: 'email', req, email: 'stranger@example.com' })
    );
    expect(sent).toHaveLength(0);
    const html = await page.text();
    expect(html).toContain('If that email is registered');
    const pending = hidden(html, 'pending');
    const tryCode = await authorizePost(
      form({ step: 'code', pending, code: '123456' })
    );
    expect(tryCode.status).toBe(400);
  });

  it('stops after five wrong codes', async () => {
    const clientId = await registerClient();
    const { challenge } = pkce();
    const q = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: REDIRECT,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });
    const req = hidden(
      await (
        await authorizeGet(new Request(`${BASE}/oauth/authorize?${q}`))
      ).text(),
      'req'
    );
    const pending = hidden(
      await (
        await authorizePost(
          form({ step: 'email', req, email: 'agent@firm.co.uk' })
        )
      ).text(),
      'pending'
    );
    const real = sent[0]?.subject.match(/(\d{6})$/)?.[1] as string;
    const wrong = real === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) {
      await authorizePost(form({ step: 'code', pending, code: wrong }));
    }
    const sixth = await authorizePost(
      form({ step: 'code', pending, code: real })
    );
    expect(sixth.status).toBe(400);
    expect(await sixth.text()).toContain('Too many attempts');
  });

  it('rejects a redirect URI the client did not register, without redirecting', async () => {
    const clientId = await registerClient();
    const { challenge } = pkce();
    const q = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: 'https://evil.example/cb',
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });
    const res = await authorizeGet(new Request(`${BASE}/oauth/authorize?${q}`));
    expect(res.status).toBe(400);
  });

  it('refuses a request without PKCE', async () => {
    const clientId = await registerClient();
    const q = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: REDIRECT,
    });
    const res = await authorizeGet(new Request(`${BASE}/oauth/authorize?${q}`));
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('error=invalid_request');
  });
});

describe('tokens', () => {
  it('will not exchange the same code twice', async () => {
    const { authCode, clientId, verifier } = await signIn('agent@firm.co.uk');
    const again = await token(
      new Request(`${BASE}/oauth/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: authCode,
          redirect_uri: REDIRECT,
          client_id: clientId,
          code_verifier: verifier,
        }).toString(),
      })
    );
    expect(again.status).toBe(400);
    expect((await again.json()).error).toBe('invalid_grant');
  });

  it('rotates refresh tokens and refuses a replayed one', async () => {
    const { body, clientId } = await signIn('agent@firm.co.uk');
    const refresh = (rt: string) =>
      token(
        new Request(`${BASE}/oauth/token`, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: rt,
            client_id: clientId,
          }).toString(),
        })
      );
    const first = await refresh(body.refresh_token);
    expect(first.status).toBe(200);
    expect((await first.json()).access_token).toBeTruthy();
    const replay = await refresh(body.refresh_token);
    expect(replay.status).toBe(400);
  });

  it('rejects a tampered access token', async () => {
    const { body } = await signIn('agent@firm.co.uk');
    const [payload, sig] = body.access_token.split('.');
    const forged = `${Buffer.from(
      JSON.stringify({
        ...JSON.parse(Buffer.from(payload, 'base64url').toString()),
        scope: ['agent', 'investor'],
      })
    ).toString('base64url')}.${sig}`;
    const r = await rpc(proMcp, 'tools/list', {}, bearer(forged));
    expect(r.status).toBe(401);
  });
});

describe('agent tools', () => {
  it('refers a sale for founder review and dedupes a repeat', async () => {
    const { body } = await signIn('agent@firm.co.uk');
    const args = {
      addressLine: '12 Oak Road',
      postcode: 'm20 2ab',
      situation: 'buyer_pulled_out',
      vendorAgreed: true,
    };
    const first = await rpc(
      proMcp,
      'tools/call',
      { name: 'refer_sale_to_kept', arguments: args },
      bearer(body.access_token)
    );
    expect(first.body.result.structuredContent.duplicate).toBe(false);
    expect(store.quotes[0]).toMatchObject({
      source: 'plugin_agent',
      referralCode: 'FIRM1',
      postcode: 'M20 2AB',
      status: 'draft',
    });
    expect(store.actions[0].title).toContain('Agent referral via ChatGPT');
    expect(store.agents[0]?.totalReferrals).toBe(1);

    const second = await rpc(
      proMcp,
      'tools/call',
      { name: 'refer_sale_to_kept', arguments: args },
      bearer(body.access_token)
    );
    expect(second.body.result.structuredContent.duplicate).toBe(true);
    expect(store.quotes).toHaveLength(1);
  });

  it('requires the agent to confirm vendor consent', async () => {
    const { body } = await signIn('agent@firm.co.uk');
    const r = await rpc(
      proMcp,
      'tools/call',
      {
        name: 'refer_sale_to_kept',
        arguments: {
          addressLine: '12 Oak Road',
          postcode: 'M20 2AB',
          situation: 'probate',
          vendorAgreed: false,
        },
      },
      bearer(body.access_token)
    );
    expect(r.body.error ?? r.body.result?.isError).toBeTruthy();
    expect(store.quotes).toHaveLength(0);
  });

  it('lists referrals without any figure', async () => {
    const { body } = await signIn('agent@firm.co.uk');
    await rpc(
      proMcp,
      'tools/call',
      {
        name: 'refer_sale_to_kept',
        arguments: {
          addressLine: '12 Oak Road',
          postcode: 'M20 2AB',
          situation: 'probate',
          vendorAgreed: true,
        },
      },
      bearer(body.access_token)
    );
    const r = await rpc(
      proMcp,
      'tools/call',
      { name: 'my_kept_referrals', arguments: {} },
      bearer(body.access_token)
    );
    const refs = r.body.result.structuredContent.referrals;
    expect(refs[0].status).toBe('With the team');
    expect(JSON.stringify(refs)).not.toMatch(/Pence|offerPence|£/);
  });

  it('cuts off an agent whose account is removed, mid-token', async () => {
    const { body } = await signIn('agent@firm.co.uk');
    store.agents = [];
    const r = await rpc(
      proMcp,
      'tools/call',
      { name: 'my_kept_referrals', arguments: {} },
      bearer(body.access_token)
    );
    expect(r.body.result.isError).toBe(true);
    expect(r.body.result.content[0].text).toMatch(/access has been removed/);
  });

  it('refuses investor tools to an agent-only sign-in', async () => {
    const { body } = await signIn('agent@firm.co.uk');
    const r = await rpc(
      proMcp,
      'tools/call',
      { name: 'kept_released_deals', arguments: {} },
      bearer(body.access_token)
    );
    expect(r.body.result.isError).toBe(true);
  });
});

describe('investor tools', () => {
  it('lists released deals only, with no address and no AVM value', async () => {
    const { body } = await signIn('investor@fund.co.uk');
    expect(body.scope).toBe('investor');
    const r = await rpc(
      proMcp,
      'tools/call',
      { name: 'kept_released_deals', arguments: {} },
      bearer(body.access_token)
    );
    const deals = r.body.result.structuredContent.deals;
    expect(deals).toHaveLength(1);
    expect(deals[0]).toMatchObject({
      dealId: 'deal_released_1',
      resalePricePounds: 185000,
    });
    const json = JSON.stringify(r.body.result);
    expect(json).not.toContain('SECRET ADDRESS');
    expect(json).not.toContain('estimatedMarketValue');
  });

  it('registers interest once and refuses an unreleased deal', async () => {
    const { body } = await signIn('investor@fund.co.uk');
    const call = (dealId: string) =>
      rpc(
        proMcp,
        'tools/call',
        { name: 'register_interest_in_deal', arguments: { dealId } },
        bearer(body.access_token)
      );
    expect(
      (await call('deal_released_1')).body.result.structuredContent
        .alreadyRegistered
    ).toBe(false);
    expect(
      (await call('deal_released_1')).body.result.structuredContent
        .alreadyRegistered
    ).toBe(true);
    expect(store.interests).toHaveLength(1);
    expect(store.actions).toHaveLength(1);
    expect((await call('deal_hidden_1')).body.result.isError).toBe(true);
  });
});
