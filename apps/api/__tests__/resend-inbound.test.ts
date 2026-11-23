import { Webhook } from 'svix';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted: vi.mock factories run before ordinary top-level constants exist.
const SECRET = vi.hoisted(
  () => `whsec_${Buffer.from('test-secret-test-secret').toString('base64')}`
);

const db = vi.hoisted(() => ({
  emailMessage: {
    findUnique: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
  },
  founderAction: { create: vi.fn() },
}));
const log = vi.hoisted(() => ({
  findEmailLinks: vi.fn(),
  recordEmail: vi.fn(),
}));

vi.mock('@/env', () => ({
  env: {
    RESEND_INBOUND_WEBHOOK_SECRET: SECRET,
    RESEND_TOKEN: 're_test',
    RESEND_FROM: 'hello@wearekept.co.uk',
  },
}));
vi.mock('@repo/database', () => ({ database: db }));
vi.mock('@repo/email/log', () => log);

import { POST } from '../app/webhooks/resend/inbound/route';

function signed(payload: unknown, secret = SECRET): Request {
  const body = JSON.stringify(payload);
  const id = 'msg_test';
  const now = new Date();
  const signature = new Webhook(secret).sign(id, now, body);
  return new Request('https://api.test/webhooks/resend/inbound', {
    method: 'POST',
    body,
    headers: {
      'svix-id': id,
      'svix-timestamp': String(Math.floor(now.getTime() / 1000)),
      'svix-signature': signature,
    },
  });
}

const received = (over: Record<string, unknown> = {}) => ({
  type: 'email.received',
  created_at: '2026-11-22T11:53:35.000Z',
  data: {
    email_id: 'em_1',
    from: 'Seller Name <Seller@Example.com>',
    to: ['inbox@abc.resend.app'],
    subject: 'Re: Welcome to Kept',
    message_id: '<abc@mail.example.com>',
    attachments: [],
    ...over,
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  db.emailMessage.findUnique.mockResolvedValue(null);
  db.emailMessage.count.mockResolvedValue(0);
  db.founderAction.create.mockResolvedValue({ id: 'fa_1' });
  log.findEmailLinks.mockResolvedValue({ dealId: null, quoteRequestId: null });
  log.recordEmail.mockResolvedValue({ id: 'row_1' });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json({
        text: 'Thanks, Tuesday works.',
        html: '<p>Thanks, Tuesday works.</p>',
        headers: { 'In-Reply-To': '<ours@resend.dev>' },
      })
    )
  );
});

describe('POST /webhooks/resend/inbound', () => {
  it('rejects a bad signature and stores nothing', async () => {
    const other = `whsec_${Buffer.from('another-secret-entirely').toString('base64')}`;
    const res = await POST(signed(received(), other));
    expect(res.status).toBe(401);
    expect(log.recordEmail).not.toHaveBeenCalled();
  });

  it('stores a reply under the bare sender address, with its body', async () => {
    const res = await POST(signed(received()));
    expect(res.status).toBe(200);
    expect(log.recordEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        direction: 'inbound',
        counterparty: 'seller@example.com',
        providerId: 'em_1',
        messageId: '<abc@mail.example.com>',
        inReplyTo: '<ours@resend.dev>',
        textBody: 'Thanks, Tuesday works.',
      })
    );
  });

  it('raises no card for a sender we have never dealt with', async () => {
    await POST(signed(received()));
    expect(db.founderAction.create).not.toHaveBeenCalled();
  });

  it('raises one card, with a dedup key, when we have emailed the sender', async () => {
    db.emailMessage.count.mockResolvedValue(1);
    await POST(signed(received()));
    expect(db.founderAction.create).toHaveBeenCalledTimes(1);
    const { data } = db.founderAction.create.mock.calls[0][0];
    expect(data.dedupKey).toBe('email-inbound:em_1');
    expect(data.metadata.link).toBe('/inbox/seller%40example.com');
  });

  it('is replay-safe: a second delivery creates nothing', async () => {
    db.emailMessage.findUnique.mockResolvedValue({ id: 'row_1' });
    const res = await POST(signed(received()));
    expect(await res.json()).toMatchObject({ duplicate: true });
    expect(log.recordEmail).not.toHaveBeenCalled();
  });

  it('drops our own forwarded notifications', async () => {
    const res = await POST(
      signed(received({ from: 'Kept <hello@wearekept.co.uk>' }))
    );
    expect(await res.json()).toMatchObject({ ignored: 'own-sender' });
    expect(log.recordEmail).not.toHaveBeenCalled();
  });

  it('still stores the message when the body cannot be fetched, and says why', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('restricted key', { status: 403 }))
    );
    const res = await POST(signed(received()));
    expect(await res.json()).toMatchObject({ bodyFetched: false });
    const stored = log.recordEmail.mock.calls[0][0];
    expect(stored.textBody).toContain('could not be fetched');
    expect(stored.textBody).toContain('403');
  });

  it('ignores other event types', async () => {
    const res = await POST(signed({ ...received(), type: 'email.clicked' }));
    expect(await res.json()).toMatchObject({ ignored: 'email.clicked' });
  });
});

describe('POST /webhooks/resend/inbound: delivery status', () => {
  const status = (type: string, extra: Record<string, unknown> = {}) => ({
    type,
    created_at: '2026-11-23T09:00:00.000Z',
    data: {
      email_id: 'sent_1',
      from: 'Kept <hello@wearekept.co.uk>',
      to: ['seller@example.com'],
      subject: 'Welcome to Kept',
      ...extra,
    },
  });

  const outboundRow = (deliveryStatus: string | null = null) => ({
    id: 'row_out',
    direction: 'outbound',
    counterparty: 'seller@example.com',
    subject: 'Welcome to Kept',
    dealId: 'deal_1',
    quoteRequestId: null,
    deliveryStatus,
  });

  it('marks an email delivered, with no card', async () => {
    db.emailMessage.findUnique.mockResolvedValue(outboundRow());
    await POST(signed(status('email.delivered')));
    expect(db.emailMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'row_out' },
        data: expect.objectContaining({ deliveryStatus: 'delivered' }),
      })
    );
    expect(db.founderAction.create).not.toHaveBeenCalled();
  });

  it('records a bounce with its reason and raises one card', async () => {
    db.emailMessage.findUnique.mockResolvedValue(outboundRow('sent'));
    await POST(
      signed(
        status('email.bounced', {
          bounce: { type: 'Permanent', message: 'No such user' },
        })
      )
    );
    expect(db.emailMessage.update.mock.calls[0][0].data).toMatchObject({
      deliveryStatus: 'bounced',
      deliveryDetail: 'Permanent: No such user',
    });
    const { data } = db.founderAction.create.mock.calls[0][0];
    expect(data.title).toBe('Bounced: email to seller@example.com');
    expect(data.dedupKey).toBe('email-delivery:sent_1:bounced');
    expect(data.dealId).toBe('deal_1');
  });

  it('does not let a late "delivered" hide a bounce', async () => {
    db.emailMessage.findUnique.mockResolvedValue(outboundRow('bounced'));
    await POST(signed(status('email.delivered')));
    expect(db.emailMessage.update).not.toHaveBeenCalled();
    expect(db.founderAction.create).not.toHaveBeenCalled();
  });

  it('ignores a status for an email that is not in the log', async () => {
    db.emailMessage.findUnique.mockResolvedValue(null);
    const res = await POST(signed(status('email.bounced')));
    expect(await res.json()).toMatchObject({
      delivery: { tracked: false, reason: 'not-logged' },
    });
    expect(db.emailMessage.update).not.toHaveBeenCalled();
  });

  it('ignores opens and clicks', async () => {
    const res = await POST(signed(status('email.opened')));
    expect(await res.json()).toMatchObject({ ignored: 'email.opened' });
    expect(db.emailMessage.findUnique).not.toHaveBeenCalled();
  });
});
