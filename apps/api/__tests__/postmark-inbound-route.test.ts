// @vitest-environment node
/**
 * /webhooks/postmark/inbound end to end, with the database faked in memory
 * and storage, email and the model stubbed. Locks down the rails:
 *
 *  - a seller never receives an acknowledgement email;
 *  - mail from an unknown sender is dropped and nothing is stored;
 *  - an email with no single deal is stored UNFILED with one card, and
 *    files itself (and closes the card) when the thread later names a deal;
 *  - a retry of the same email stores nothing twice.
 */
import { beforeEach, describe, expect, test, vi } from 'vitest';

type Row = Record<string, unknown>;

const state = vi.hoisted(() => ({
  deals: [] as Row[],
  emails: [] as Row[],
  extracts: [] as Row[],
  actions: [] as Row[],
  sent: [] as Row[],
  stored: [] as string[],
  afterTasks: [] as Promise<unknown>[],
}));

vi.mock('@/env', () => ({
  env: {
    POSTMARK_INBOUND_USER: 'pm-user',
    POSTMARK_INBOUND_PASS: 'pm-pass',
    EMAIL_FORWARD_ALLOWLIST: 'sam@wearekept.co.uk',
    DEAL_LOG_ADDRESS: 'log@in.wearekept.co.uk',
  },
}));

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return {
    ...actual,
    // Run the post-response work straight away and let the test await it.
    after: (task: () => Promise<unknown>) => {
      state.afterTasks.push(task());
    },
  };
});

vi.mock('@repo/storage', () => ({
  put: (path: string) => {
    state.stored.push(path);
    return Promise.resolve({ url: `https://blob.example/${path}` });
  },
}));

vi.mock('@repo/email', () => ({
  sendEmail: (input: Row) => {
    state.sent.push(input);
    return Promise.resolve({ ok: true });
  },
}));

vi.mock('@repo/document-pipeline', () => ({
  extractProbateFromPdf: () =>
    Promise.resolve({
      confidence: 0.9,
      deceasedName: { value: 'A. Person' },
      propertyAddresses: [],
      errorReason: null,
    }),
}));

vi.mock('../app/webhooks/postmark/_lib/digest', () => ({
  digestDealEmail: () =>
    Promise.resolve({
      summary: 'A short read.',
      party: 'vendor',
      needsReply: true,
      nextStep: 'Reply.',
    }),
}));

vi.mock('@repo/database', () => {
  type Cond = Record<string, { equals?: string; in?: string[] }>;
  const eq = (a: unknown, b: unknown) =>
    String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase();
  const matchesOr = (row: Row, or: Cond[]) =>
    or.some((cond) =>
      Object.entries(cond).every(([field, test]) =>
        test.in
          ? test.in.includes(String(row[field]))
          : eq(row[field], test.equals)
      )
    );
  let seq = 0;
  const nextId = (prefix: string) => `${prefix}-${++seq}`;

  return {
    database: {
      deal: {
        findUnique: ({ where }: { where: { id: string } }) =>
          Promise.resolve(state.deals.find((d) => d.id === where.id) ?? null),
        findMany: ({ where }: { where: { OR: Cond[] } }) =>
          Promise.resolve(state.deals.filter((d) => matchesOr(d, where.OR))),
      },
      dealEmail: {
        findUnique: ({ where }: { where: { messageId: string } }) =>
          Promise.resolve(
            state.emails.find((e) => e.messageId === where.messageId) ?? null
          ),
        findMany: ({ where }: { where: { OR: Cond[] } }) =>
          Promise.resolve(state.emails.filter((e) => matchesOr(e, where.OR))),
        create: ({ data }: { data: Row }) => {
          const row = { id: nextId('email'), ...data };
          state.emails.push(row);
          return Promise.resolve(row);
        },
        updateMany: ({
          where,
          data,
        }: {
          where: { threadKey: string; dealId: null };
          data: Row;
        }) => {
          const hits = state.emails.filter(
            (e) => e.threadKey === where.threadKey && e.dealId === null
          );
          for (const hit of hits) {
            Object.assign(hit, data);
          }
          return Promise.resolve({ count: hits.length });
        },
        update: ({ where, data }: { where: { id: string }; data: Row }) => {
          const row = state.emails.find((e) => e.id === where.id);
          if (row) {
            Object.assign(row, data);
          }
          return Promise.resolve(row);
        },
      },
      documentExtract: {
        create: ({ data }: { data: Row }) => {
          const row = { id: nextId('extract'), ...data };
          state.extracts.push(row);
          return Promise.resolve(row);
        },
      },
      founderAction: {
        create: ({ data }: { data: Row }) => {
          if (
            data.dedupKey &&
            state.actions.some((a) => a.dedupKey === data.dedupKey)
          ) {
            return Promise.reject(
              Object.assign(new Error('unique'), { code: 'P2002' })
            );
          }
          state.actions.push({ ...data });
          return Promise.resolve(data);
        },
        updateMany: ({
          where,
          data,
        }: {
          where: { dedupKey: string; status: string };
          data: Row;
        }) => {
          const hits = state.actions.filter(
            (a) => a.dedupKey === where.dedupKey && a.status === where.status
          );
          for (const hit of hits) {
            Object.assign(hit, data);
          }
          return Promise.resolve({ count: hits.length });
        },
      },
    },
  };
});

import { POST } from '../app/webhooks/postmark/inbound/route';

const FOUNDER = 'sam@wearekept.co.uk';
const LOG = 'log@in.wearekept.co.uk';
const SELLER = 'jane@example.com';
const DEAL_ID = 'cm3x9k2p40001abcd1234efgh';
const AUTH = `Basic ${Buffer.from('pm-user:pm-pass').toString('base64')}`;

type Overrides = {
  from?: string;
  to?: string[];
  cc?: string[];
  subject?: string;
  text?: string;
  messageId?: string;
  inReplyTo?: string;
  mailboxHash?: string;
  attachments?: Row[];
};

function body(o: Overrides = {}): Row {
  const from = o.from ?? FOUNDER;
  const headers = [
    { Name: 'Message-ID', Value: `<${o.messageId ?? 'root@mail'}>` },
  ];
  if (o.inReplyTo) {
    headers.push(
      { Name: 'In-Reply-To', Value: `<${o.inReplyTo}>` },
      { Name: 'References', Value: `<${o.inReplyTo}>` }
    );
  }
  return {
    From: from,
    FromFull: { Email: from, Name: '', MailboxHash: '' },
    ToFull: (o.to ?? [SELLER]).map((Email) => ({ Email, Name: '' })),
    CcFull: (o.cc ?? [LOG]).map((Email) => ({ Email, Name: '' })),
    OriginalRecipient: LOG,
    MailboxHash: o.mailboxHash ?? '',
    Subject: o.subject ?? 'Your home',
    Date: 'Sat, 21 Nov 2026 14:02:11 +0000',
    TextBody: o.text ?? 'Hello, thank you for your time today.',
    Headers: headers,
    Attachments: o.attachments ?? [],
  };
}

async function post(payload: Row, auth: string | null = AUTH) {
  const res = await POST(
    new Request('https://api.test/webhooks/postmark/inbound', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(auth ? { authorization: auth } : {}),
      },
      body: JSON.stringify(payload),
    })
  );
  await Promise.all(state.afterTasks.splice(0));
  return { status: res.status, json: (await res.json()) as Row };
}

beforeEach(() => {
  state.deals = [
    {
      id: DEAL_ID,
      address: '12 Acacia Avenue',
      postcode: 'M14 5AB',
      status: 'offer_made',
      sellerEmail: SELLER,
      solicitorEmail: null,
    },
  ];
  state.emails = [];
  state.extracts = [];
  state.actions = [];
  state.sent = [];
  state.stored = [];
  state.afterTasks = [];
});

describe('POST /webhooks/postmark/inbound', () => {
  test('rejects a caller without Postmark’s credentials', async () => {
    expect((await post(body(), null)).status).toBe(401);
    expect((await post(body(), 'Basic bm9wZTpub3Bl')).status).toBe(401);
    expect(state.emails).toHaveLength(0);
  });

  test('founder CCs the log on an email to a seller: stored on the deal', async () => {
    const { json } = await post(body());
    expect(json).toMatchObject({
      success: true,
      direction: 'outbound',
      dealMatched: DEAL_ID,
      matchedBy: 'participant',
    });
    expect(state.emails).toHaveLength(1);
    expect(state.emails[0]).toMatchObject({
      dealId: DEAL_ID,
      fromEmail: FOUNDER,
      toEmails: [SELLER],
      threadKey: 'root@mail',
      summary: 'A short read.',
    });
    // A conversation is not a forward: no acknowledgement, no card.
    expect(state.sent).toHaveLength(0);
    expect(state.actions).toHaveLength(0);
  });

  test('the seller’s reply-all lands on the same deal, and gets NO email back', async () => {
    await post(body());
    const { json } = await post(
      body({
        from: SELLER,
        to: [FOUNDER],
        messageId: 'reply@mail',
        inReplyTo: 'root@mail',
        text: 'Tuesday works for me.',
      })
    );
    expect(json).toMatchObject({
      direction: 'inbound',
      dealMatched: DEAL_ID,
      matchedBy: 'thread',
    });
    expect(state.emails.map((e) => e.threadKey)).toEqual([
      'root@mail',
      'root@mail',
    ]);
    expect(state.sent).toHaveLength(0);
  });

  test('an unknown sender is dropped: nothing stored, nothing kept', async () => {
    const { status, json } = await post(
      body({
        from: 'mallory@example.net',
        to: [LOG],
        cc: [],
        text: 'About M14 5AB.',
        attachments: [
          {
            Name: 'x.pdf',
            ContentType: 'application/pdf',
            Content: 'AAAA',
            ContentLength: 3,
          },
        ],
      })
    );
    expect(status).toBe(200);
    expect(json).toEqual({ success: true, dropped: true });
    expect(state.emails).toHaveLength(0);
    expect(state.stored).toHaveLength(0);
    expect(state.sent).toHaveLength(0);
  });

  test('a retry of the same email stores one row', async () => {
    await post(body());
    const { json } = await post(body());
    expect(json).toEqual({ success: true, duplicate: true });
    expect(state.emails).toHaveLength(1);
  });

  test('no single deal: stored unfiled with ONE card for the conversation', async () => {
    const first = await post(
      body({ to: ['new.agent@agency.example'], text: 'Is it still for sale?' })
    );
    expect(first.json).toMatchObject({ dealMatched: null, matchedBy: null });
    expect(state.emails[0]).toMatchObject({ dealId: null });
    expect(state.actions).toHaveLength(1);
    expect(state.actions[0]).toMatchObject({
      dedupKey: 'deal_email_unfiled:root@mail',
      status: 'pending',
      metadata: { link: '/deals/email-log' },
    });

    // The agent replies in the same thread: kept, still unfiled, no new card.
    await post(
      body({
        from: 'new.agent@agency.example',
        to: [FOUNDER],
        messageId: 'r1@mail',
        inReplyTo: 'root@mail',
      })
    );
    expect(state.emails).toHaveLength(2);
    expect(state.actions).toHaveLength(1);
  });

  test('naming the deal later files the whole thread and closes the card', async () => {
    await post(body({ to: ['new.agent@agency.example'] }));
    const { json } = await post(
      body({
        to: ['new.agent@agency.example'],
        messageId: 'r2@mail',
        inReplyTo: 'root@mail',
        mailboxHash: DEAL_ID,
      })
    );
    expect(json).toMatchObject({ dealMatched: DEAL_ID, matchedBy: 'deal_tag' });
    expect(state.emails.map((e) => e.dealId)).toEqual([DEAL_ID, DEAL_ID]);
    expect(state.actions[0]).toMatchObject({ status: 'completed' });
  });

  test('a founder’s forward to the log alone: PDF read, founder acknowledged', async () => {
    const { json } = await post(
      body({
        to: [LOG],
        cc: [],
        subject: 'Fwd: grant of probate M14 5AB',
        text: 'See attached. M14 5AB',
        attachments: [
          {
            Name: 'grant.pdf',
            ContentType: 'application/pdf',
            Content: Buffer.from('%PDF-1.4').toString('base64'),
            ContentLength: 8,
          },
        ],
      })
    );
    expect(json).toMatchObject({
      direction: 'forward',
      dealMatched: DEAL_ID,
      matchedBy: 'postcode',
      extractedCount: 1,
    });
    expect(state.extracts[0]).toMatchObject({
      dealId: DEAL_ID,
      docType: 'probate',
      sourceType: 'email_forward',
    });
    expect(state.sent).toHaveLength(1);
    expect(state.sent[0]).toMatchObject({ to: FOUNDER });
    const attachments = state.emails[0]?.attachments as Row[];
    expect(attachments[0]).toMatchObject({
      filename: 'grant.pdf',
      url: `https://blob.example/deal-emails/${DEAL_ID}/grant.pdf`,
      extractId: state.extracts[0]?.id,
    });
  });

  test('keeps a real attachment, skips a signature logo, reads no PDF in a conversation', async () => {
    await post(
      body({
        attachments: [
          {
            Name: 'logo.png',
            ContentType: 'image/png',
            Content: 'AAAA',
            ContentLength: 2_000,
            ContentID: 'cid:logo',
          },
          {
            Name: 'Title register.pdf',
            ContentType: 'application/pdf',
            Content: 'AAAA',
            ContentLength: 3,
          },
        ],
      })
    );
    expect(state.stored).toEqual([`deal-emails/${DEAL_ID}/Title_register.pdf`]);
    expect(state.extracts).toHaveLength(0);
    const attachments = state.emails[0]?.attachments as Row[];
    expect(attachments.map((a) => a.filename)).toEqual(['Title register.pdf']);
  });
});
