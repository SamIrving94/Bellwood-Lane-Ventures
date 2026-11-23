import { describe, expect, it } from 'vitest';
import {
  type EmailRow,
  autoCopyStatus,
  companyAccount,
  dealLogAddress,
  gmailComposeUrl,
  mailtoUrl,
  toEmailCards,
} from './deal-email-view';

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

describe('starting an email from the deal page', () => {
  const input = {
    to: 'jane@example.com',
    cc: 'log+cm3x9k2p40001abcd1234efgh@in.wearekept.co.uk',
    subject: '12 Acacia Avenue, M14 5AB',
  };

  it('Gmail: fills To, CC and subject', () => {
    const url = new URL(gmailComposeUrl(input));
    expect(url.origin + url.pathname).toBe('https://mail.google.com/mail/');
    expect(url.searchParams.get('view')).toBe('cm');
    expect(url.searchParams.get('to')).toBe(input.to);
    expect(url.searchParams.get('cc')).toBe(input.cc);
    expect(url.searchParams.get('su')).toBe(input.subject);
    expect(url.searchParams.has('authuser')).toBe(false);
  });

  it('Gmail: the "+" in the deal address survives as %2B, not a space', () => {
    const url = gmailComposeUrl(input);
    expect(url).toContain(
      'cc=log%2Bcm3x9k2p40001abcd1234efgh%40in.wearekept.co.uk'
    );
    expect(url).not.toContain('cc=log+');
  });

  it('Gmail: names the company account when we know it', () => {
    const url = new URL(
      gmailComposeUrl({ ...input, account: 'sam@wearekept.co.uk' })
    );
    expect(url.searchParams.get('authuser')).toBe('sam@wearekept.co.uk');
  });

  it('mailto: same three fields, "+" encoded', () => {
    expect(mailtoUrl(input)).toBe(
      'mailto:jane@example.com?cc=log%2Bcm3x9k2p40001abcd1234efgh%40in.wearekept.co.uk&subject=12%20Acacia%20Avenue%2C%20M14%205AB'
    );
  });

  it('mailto: an odd recipient cannot add its own headers', () => {
    expect(mailtoUrl({ ...input, to: 'a@b.com?bcc=evil@x.com' })).toContain(
      'mailto:a@b.com%3Fbcc%3Devil@x.com?cc='
    );
  });
});

describe('companyAccount', () => {
  const log = 'log@in.wearekept.co.uk';

  it('picks the address at the domain the log address hangs off', () => {
    expect(companyAccount(['sam@gmail.com', 'Sam@WeAreKept.co.uk'], log)).toBe(
      'sam@wearekept.co.uk'
    );
  });

  it('does not guess when none is', () => {
    expect(companyAccount(['sam@gmail.com'], log)).toBeNull();
    expect(companyAccount([], log)).toBeNull();
    expect(companyAccount(['x@co.uk'], log)).toBeNull();
  });
});

describe('autoCopyStatus', () => {
  const now = new Date('2026-11-23T12:00:00Z');

  it('reads the last-seen mark', () => {
    expect(autoCopyStatus({ lastSeenAt: '2026-11-23T11:30:00Z' }, now)).toEqual(
      { lastSeenAt: new Date('2026-11-23T11:30:00Z'), quiet: false }
    );
  });

  it('flags a mailbox that has been silent for over a day', () => {
    expect(
      autoCopyStatus({ lastSeenAt: '2026-11-21T09:00:00Z' }, now)?.quiet
    ).toBe(true);
  });

  it('is null when there is no mark, or it is not a date', () => {
    expect(autoCopyStatus(null, now)).toBeNull();
    expect(autoCopyStatus({}, now)).toBeNull();
    expect(autoCopyStatus({ lastSeenAt: 'soon' }, now)).toBeNull();
  });
});
