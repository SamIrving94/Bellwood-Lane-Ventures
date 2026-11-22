import { describe, expect, it } from 'vitest';
import { type EmailRow, dealLogAddress, toEmailCards } from './deal-email-view';

function row(over: Partial<EmailRow> = {}): EmailRow {
  return {
    id: 'e1',
    dealId: 'deal-1',
    threadKey: 'root@x',
    direction: 'inbound',
    fromEmail: 'jane@example.com',
    fromName: 'Jane',
    toEmails: ['sam@wearekept.co.uk'],
    ccEmails: [],
    subject: 'Re: your offer',
    bodyText: 'Can you do Tuesday?',
    replyText: null,
    sentAt: new Date('2026-11-20T10:00:00Z'),
    matchedBy: 'thread',
    summary: 'Jane asks for a Tuesday viewing.',
    party: 'vendor',
    needsReply: true,
    nextStep: 'Confirm Tuesday.',
    attachments: null,
    ...over,
  };
}

describe('toEmailCards — waiting on us', () => {
  it('flags a question nobody has answered', () => {
    expect(toEmailCards([row()])[0]?.waitingOnUs).toBe(true);
  });

  it('clears once a later email from us is in the same thread', () => {
    const cards = toEmailCards([
      row(),
      row({
        id: 'e2',
        direction: 'outbound',
        needsReply: false,
        sentAt: new Date('2026-11-20T12:00:00Z'),
      }),
    ]);
    expect(cards.map((c) => c.waitingOnUs)).toEqual([false, false]);
  });

  it('an EARLIER email from us does not answer a later question', () => {
    const cards = toEmailCards([
      row(),
      row({
        id: 'e0',
        direction: 'outbound',
        needsReply: false,
        sentAt: new Date('2026-11-19T09:00:00Z'),
      }),
    ]);
    expect(cards[0]?.waitingOnUs).toBe(true);
  });

  it('a reply in a different thread does not answer it', () => {
    const cards = toEmailCards([
      row(),
      row({
        id: 'e2',
        threadKey: 'other@x',
        direction: 'outbound',
        sentAt: new Date('2026-11-21T09:00:00Z'),
      }),
    ]);
    expect(cards[0]?.waitingOnUs).toBe(true);
  });

  it('is never set without a model read saying so', () => {
    expect(toEmailCards([row({ needsReply: null })])[0]?.waitingOnUs).toBe(
      false
    );
  });

  it('is never set on our own email', () => {
    expect(
      toEmailCards([row({ direction: 'outbound', needsReply: true })])[0]
        ?.waitingOnUs
    ).toBe(false);
  });
});

describe('toEmailCards — shaping', () => {
  it('keeps only well-formed attachments', () => {
    const cards = toEmailCards([
      row({
        attachments: [
          {
            filename: 'title.pdf',
            contentType: 'application/pdf',
            sizeBytes: 9,
          },
          null,
          'junk',
          { contentType: 'image/png' },
        ],
      }),
    ]);
    expect(cards[0]?.attachments.map((a) => a.filename)).toEqual(['title.pdf']);
  });

  it('trims a very long body for the browser', () => {
    const cards = toEmailCards([row({ bodyText: 'x'.repeat(50_000) })]);
    expect(cards[0]?.bodyText.length).toBeLessThan(21_000);
    expect(cards[0]?.bodyText).toContain('Long email trimmed here');
  });
});

describe('dealLogAddress', () => {
  it('adds the deal id as a plus tag', () => {
    expect(dealLogAddress('log@in.wearekept.co.uk', 'abc123')).toBe(
      'log+abc123@in.wearekept.co.uk'
    );
  });

  it('replaces a tag that is already there', () => {
    expect(dealLogAddress('log+old@in.wearekept.co.uk', 'abc123')).toBe(
      'log+abc123@in.wearekept.co.uk'
    );
  });
});
