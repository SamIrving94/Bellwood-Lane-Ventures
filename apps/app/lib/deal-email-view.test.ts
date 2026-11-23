import { describe, expect, it } from 'vitest';
import {
  type EmailRow,
  gmailComposeUrl,
  gmailThreadUrl,
  mailtoUrl,
  syncHealth,
  toEmailCards,
} from './deal-email-view';

function row(over: Partial<EmailRow> = {}): EmailRow {
  return {
    id: 'e1',
    dealId: 'deal-1',
    gmailThreadId: 'T1',
    threadKey: 'gmail:T1',
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
        threadKey: 'gmail:T2',
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

describe('links into Gmail', () => {
  const KEPT = 'sam@wearekept.co.uk';

  it('compose: recipient, subject, and the Kept account', () => {
    const url = new URL(
      gmailComposeUrl({
        to: 'jane@example.com',
        subject: '12 Acacia Avenue, M14 5AB',
        account: KEPT,
      })
    );
    expect(url.origin + url.pathname).toBe('https://mail.google.com/mail/');
    expect(url.searchParams.get('authuser')).toBe(KEPT);
    expect(url.searchParams.get('view')).toBe('cm');
    expect(url.searchParams.get('to')).toBe('jane@example.com');
    expect(url.searchParams.get('su')).toBe('12 Acacia Avenue, M14 5AB');
    // Nothing is copied in: the log reads the mailbox.
    expect(url.searchParams.has('cc')).toBe(false);
  });

  it('compose: no account named when Google is not connected', () => {
    const url = new URL(
      gmailComposeUrl({ to: 'a@b.com', subject: 'Hi', account: null })
    );
    expect(url.searchParams.has('authuser')).toBe(false);
  });

  it('open a conversation in the Kept account', () => {
    expect(gmailThreadUrl('18c2f0a1b2c3d4e5', KEPT)).toBe(
      'https://mail.google.com/mail/?authuser=sam%40wearekept.co.uk#all/18c2f0a1b2c3d4e5'
    );
    expect(gmailThreadUrl('18c2f0a1b2c3d4e5', null)).toBe(
      'https://mail.google.com/mail/#all/18c2f0a1b2c3d4e5'
    );
  });

  it('mailto: an odd recipient cannot add its own headers', () => {
    expect(
      mailtoUrl({ to: 'a@b.com?bcc=evil@x.com', subject: '12 Acacia Avenue' })
    ).toBe('mailto:a@b.com%3Fbcc%3Devil@x.com?subject=12%20Acacia%20Avenue');
  });
});

describe('syncHealth', () => {
  const now = new Date('2026-11-23T12:00:00Z');

  it('never run', () => {
    expect(syncHealth(null, now)).toBe('never');
    expect(syncHealth('not a date', now)).toBe('never');
  });

  it('ran within the last two hours', () => {
    expect(syncHealth('2026-11-23T11:40:00Z', now)).toBe('ok');
  });

  it('has stopped running', () => {
    expect(syncHealth('2026-11-23T08:00:00Z', now)).toBe('stale');
  });
});
