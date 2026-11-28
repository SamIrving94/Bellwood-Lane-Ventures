/**
 * The deal email log, read from Gmail.
 *
 * Three promises are pinned here:
 *  - only deal mail is kept, and the body of anything else is never fetched;
 *  - an email is filed on a deal only when that deal is the ONLY candidate;
 *  - a note between colleagues is never picked up unasked.
 *
 * Gmail and the database are in-memory fakes behind `GmailPort` and
 * `StorePort`. The message shapes follow the Gmail API's `users.messages`
 * resource; they have not been checked against a live mailbox.
 */

import { describe, expect, test } from 'vitest';
import {
  type GmailPort,
  type MailToSave,
  type StorePort,
  dealHistoryQuery,
  runDealMailImport,
  sinceQuery,
} from '../deal-mail-import';
import {
  type DealCandidate,
  type DealLookups,
  type MailForMatch,
  directionOf,
  outsideParties,
  pickOne,
  mailboxRefusal,
  resolveDeal,
} from '../deal-mail-match';
import {
  type GmailMessage,
  type GmailPart,
  displayName,
  extractBody,
  extractPostcodes,
  listAttachments,
  parseAddressList,
  stripQuotedHistory,
  toDealMail,
} from '../gmail-message';

const NOW = new Date('2026-11-23T12:00:00Z');
const MAILBOX = 'sam@wearekept.co.uk';
const SELLER = 'jane@example.com';
const LABELS = { log: 'Label_log', logged: 'Label_logged' };

const b64 = (text: string) =>
  Buffer.from(text, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const textPart = (text: string, mimeType = 'text/plain'): GmailPart => ({
  mimeType,
  filename: '',
  body: { size: text.length, data: b64(text) },
});

type MessageInput = {
  id: string;
  threadId?: string;
  from?: string;
  to?: string;
  cc?: string;
  subject?: string;
  body?: string;
  at?: string;
  labelIds?: string[];
  parts?: GmailPart[];
  /** RFC Message-ID. Defaults to one made from the Gmail id. */
  messageId?: string;
};

/** A `format=full` message. `meta()` strips it down to `format=metadata`. */
const full = (m: MessageInput): GmailMessage => ({
  id: m.id,
  threadId: m.threadId ?? `t-${m.id}`,
  labelIds: m.labelIds ?? ['INBOX'],
  snippet: (m.body ?? '').slice(0, 200),
  internalDate: String(new Date(m.at ?? '2026-11-22T10:00:00Z').getTime()),
  payload: {
    mimeType: 'multipart/mixed',
    headers: [
      { name: 'From', value: m.from ?? `Sam <${MAILBOX}>` },
      { name: 'To', value: m.to ?? SELLER },
      ...(m.cc ? [{ name: 'Cc', value: m.cc }] : []),
      { name: 'Subject', value: m.subject ?? 'Your home' },
      {
        name: 'Message-ID',
        value: `<${m.messageId ?? `${m.id}@mail.gmail.com`}>`,
      },
    ],
    parts: m.parts ?? [textPart(m.body ?? 'Hello.')],
  },
});

const meta = (message: GmailMessage): GmailMessage => ({
  ...message,
  payload: { headers: message.payload?.headers },
});

// ───────────────────────────────────────────────────────────────────────────

describe('reading a Gmail message', () => {
  test('headers, thread and date', () => {
    const mail = toDealMail(
      full({
        id: 'm1',
        threadId: 'T9',
        from: '"Jane Smith" <Jane@Example.com>',
        to: `Sam <${MAILBOX}>, other@example.org`,
        cc: 'p.khan@harlowlaw.example',
        subject: ' Re: 12 Acacia Avenue ',
        at: '2026-11-21T14:02:00Z',
      }),
      NOW
    );
    expect(mail).toMatchObject({
      gmailId: 'm1',
      gmailThreadId: 'T9',
      threadKey: 'gmail:T9',
      messageId: 'm1@mail.gmail.com',
      fromEmail: 'jane@example.com',
      fromName: 'Jane Smith',
      toEmails: [MAILBOX, 'other@example.org'],
      ccEmails: ['p.khan@harlowlaw.example'],
      subject: 'Re: 12 Acacia Avenue',
      sentAt: new Date('2026-11-21T14:02:00Z'),
    });
  });

  test('a metadata-only message has no body and no attachments', () => {
    const mail = toDealMail(meta(full({ id: 'm1', body: 'Secret.' })), NOW);
    expect(mail?.bodyText).toBe('');
    expect(mail?.attachments).toEqual([]);
    expect(mail?.snippet).toBe('Secret.');
  });

  test('no sender address is the one thing we cannot work without', () => {
    expect(toDealMail(full({ id: 'm1', from: 'nobody' }), NOW)).toBeNull();
  });

  test('a date in the future cannot pin an email to the top', () => {
    const mail = toDealMail(
      full({ id: 'm1', at: '2038-01-01T00:00:00Z' }),
      NOW
    );
    expect(mail?.sentAt).toEqual(NOW);
  });

  test('display name: quoted, bare, or absent', () => {
    expect(displayName('"Jo Bloggs" <jo@x.co.uk>')).toBe('Jo Bloggs');
    expect(displayName('Jo Bloggs <jo@x.co.uk>')).toBe('Jo Bloggs');
    expect(displayName('jo@x.co.uk')).toBeNull();
    expect(displayName('<jo@x.co.uk>')).toBeNull();
  });

  test('address lists keep order and drop repeats', () => {
    expect(parseAddressList('A <a@x.com>, b@y.org, "A" <A@X.com>')).toEqual([
      'a@x.com',
      'b@y.org',
    ]);
  });

  test('postcodes: full ones only, normalised', () => {
    expect(extractPostcodes('at m145ab and SW1A  1AA, near M14')).toEqual([
      'M14 5AB',
      'SW1A 1AA',
    ]);
  });
});

describe('the body', () => {
  test('plain text is preferred over HTML', () => {
    const payload: GmailPart = {
      mimeType: 'multipart/alternative',
      parts: [
        textPart('<p>Hello <b>Sam</b></p>', 'text/html'),
        textPart('Hello Sam'),
      ],
    };
    expect(extractBody(payload)).toBe('Hello Sam');
  });

  test('HTML is turned into text when it is all there is', () => {
    const payload = textPart(
      '<style>p{color:red}</style><p>Dear Sam</p><p>The grant is in.<br>Regards</p>',
      'text/html'
    );
    expect(extractBody(payload)).toBe('Dear Sam\nThe grant is in.\nRegards');
  });

  test('found inside nested multiparts', () => {
    const payload: GmailPart = {
      mimeType: 'multipart/mixed',
      parts: [
        {
          mimeType: 'multipart/alternative',
          parts: [textPart('Deep inside.')],
        },
      ],
    };
    expect(extractBody(payload)).toBe('Deep inside.');
  });

  test('a text file attachment is not mistaken for the body', () => {
    const payload: GmailPart = {
      mimeType: 'multipart/mixed',
      parts: [
        { ...textPart('column,a,b'), filename: 'data.csv' },
        textPart('See attached.'),
      ],
    };
    expect(extractBody(payload)).toBe('See attached.');
  });

  test('accented characters survive the base64url round trip', () => {
    expect(extractBody(textPart('Café — £450 ✓'))).toBe('Café — £450 ✓');
  });
});

describe('attachments', () => {
  const file = (
    filename: string,
    mimeType: string,
    size: number,
    contentId?: string
  ): GmailPart => ({
    mimeType,
    filename,
    headers: contentId ? [{ name: 'Content-ID', value: contentId }] : [],
    body: { size, attachmentId: 'att' },
  });

  test('listed by name; a signature logo is left out; a photo is kept', () => {
    const payload: GmailPart = {
      mimeType: 'multipart/mixed',
      parts: [
        textPart('See attached.'),
        file('Title register.pdf', 'application/pdf', 184_320),
        file('logo.png', 'image/png', 4_000, '<logo>'),
        file('kitchen.jpg', 'image/jpeg', 900_000, '<photo>'),
      ],
    };
    expect(listAttachments(payload)).toEqual([
      {
        filename: 'Title register.pdf',
        contentType: 'application/pdf',
        sizeBytes: 184_320,
      },
      {
        filename: 'kitchen.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 900_000,
      },
    ]);
  });
});

describe('cutting off the quoted history', () => {
  test('Gmail style', () => {
    expect(
      stripQuotedHistory(
        'Tuesday works.\n\nJane\n\nOn Fri, 20 Nov 2026 at 09:30, Sam <sam@wearekept.co.uk> wrote:\n> Would Tuesday suit?'
      )
    ).toBe('Tuesday works.\n\nJane');
  });

  test('Gmail style wrapped onto a second line', () => {
    expect(
      stripQuotedHistory(
        'Yes.\n\nOn Fri, 20 Nov 2026 at 09:30, Sam Irving <sam@wearekept.co.uk>\nwrote:\n> Would Tuesday suit?'
      )
    ).toBe('Yes.');
  });

  test('Outlook style', () => {
    expect(
      stripQuotedHistory(
        'Please see attached.\n\nFrom: Sam Irving\nSent: 20 November 2026 09:30\nTo: Priya'
      )
    ).toBe('Please see attached.');
    expect(
      stripQuotedHistory('Noted.\n\n-----Original Message-----\nFrom: Sam')
    ).toBe('Noted.');
  });

  test('nothing to cut, or nothing left after cutting, means no change', () => {
    expect(stripQuotedHistory('Just a note.')).toBeNull();
    expect(
      stripQuotedHistory(
        'On Fri, 20 Nov 2026, Sam wrote:\n> Would Tuesday suit?'
      )
    ).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────────

const deal = (
  id: string,
  postcode = 'M14 5AB',
  open = true
): DealCandidate => ({ id, postcode, open });

const lookups = (over: Partial<DealLookups> = {}): DealLookups => ({
  threadDeal: async () => null,
  dealsByParticipant: async () => [],
  dealsByPostcode: async () => [],
  ...over,
});

const never = (): never => {
  throw new Error('no database question should be asked');
};
const noLookups: DealLookups = {
  threadDeal: never,
  dealsByParticipant: never,
  dealsByPostcode: never,
};

const mail = (over: Partial<MailForMatch> = {}): MailForMatch => ({
  fromEmail: MAILBOX,
  toEmails: [SELLER],
  ccEmails: [],
  threadKey: 'gmail:T1',
  postcodes: [],
  explicit: false,
  ...over,
});
const fromJane = { fromEmail: SELLER, toEmails: [MAILBOX] };

describe('who is who', () => {
  test('anyone at the mailbox’s domain is inside the company', () => {
    expect(
      outsideParties(
        mail({ ccEmails: ['Ant@WeAreKept.co.uk', 'p@law.example'] }),
        MAILBOX
      )
    ).toEqual([SELLER, 'p@law.example']);
  });

  test('direction follows the sender', () => {
    expect(directionOf(mail(), MAILBOX)).toBe('outbound');
    expect(
      directionOf(mail({ fromEmail: 'ant@wearekept.co.uk' }), MAILBOX)
    ).toBe('outbound');
    expect(directionOf(mail(fromJane), MAILBOX)).toBe('inbound');
  });
});

describe('pickOne', () => {
  test('one candidate wins; the same deal twice is one candidate', () => {
    expect(pickOne([deal('a')], [])?.id).toBe('a');
    expect(pickOne([deal('a'), deal('a')], [])?.id).toBe('a');
  });

  test('the only open deal beats closed ones', () => {
    expect(pickOne([deal('a', 'M1 1AA', false), deal('b')], [])?.id).toBe('b');
  });

  test('two open deals are settled by a postcode in the email', () => {
    const cands = [deal('a', 'M14 5AB'), deal('b', 'SW1A 1AA')];
    expect(pickOne(cands, ['SW1A 1AA'])?.id).toBe('b');
  });

  test('two open deals and nothing to tell them apart is no match', () => {
    expect(pickOne([deal('a'), deal('b')], [])).toBeNull();
    expect(pickOne([deal('a'), deal('b')], ['M14 5AB'])).toBeNull();
  });
});

describe('resolveDeal', () => {
  test('our email to a deal’s seller is kept and filed', async () => {
    const asked: string[][] = [];
    const m = await resolveDeal(
      mail(),
      MAILBOX,
      lookups({
        dealsByParticipant: async (emails) => {
          asked.push(emails);
          return [deal('deal-1')];
        },
      })
    );
    // Never our own address: a test deal with the founder's email on it
    // would swallow every email otherwise.
    expect(asked).toEqual([[SELLER]]);
    expect(m).toEqual({
      accepted: true,
      dealId: 'deal-1',
      matchedBy: 'participant',
    });
  });

  test('the seller’s email to us is kept and filed', async () => {
    const m = await resolveDeal(
      mail(fromJane),
      MAILBOX,
      lookups({ dealsByParticipant: async () => [deal('deal-1')] })
    );
    expect(m).toMatchObject({ accepted: true, dealId: 'deal-1' });
  });

  test('someone else’s email is matched on the SENDER only', async () => {
    const asked: string[][] = [];
    await resolveDeal(
      mail({ fromEmail: 'mallory@example.net', toEmails: [MAILBOX, SELLER] }),
      MAILBOX,
      lookups({
        dealsByParticipant: async (emails) => {
          asked.push(emails);
          return [];
        },
      })
    );
    expect(asked).toEqual([['mallory@example.net']]);
  });

  test('a reply stays on the deal its conversation is on', async () => {
    const m = await resolveDeal(
      mail({ fromEmail: 'new.person@lawfirm.example', toEmails: [MAILBOX] }),
      MAILBOX,
      lookups({ threadDeal: async () => ({ dealId: 'deal-1' }) })
    );
    expect(m).toEqual({
      accepted: true,
      dealId: 'deal-1',
      matchedBy: 'thread',
    });
  });

  test('our ordinary email to anyone else is ignored', async () => {
    const m = await resolveDeal(
      mail({ toEmails: ['friend@example.org'] }),
      MAILBOX,
      lookups()
    );
    expect(m).toEqual({ accepted: false, dealId: null, matchedBy: null });
  });

  test('ordinary inbound mail is ignored, even when it names a deal’s postcode', async () => {
    const m = await resolveDeal(
      mail({
        fromEmail: 'news@portal.example',
        toEmails: [MAILBOX],
        postcodes: ['M14 5AB'],
      }),
      MAILBOX,
      lookups({ dealsByPostcode: async () => [deal('deal-1')] })
    );
    expect(m.accepted).toBe(false);
  });

  test('a note between colleagues is never picked up, even with a postcode', async () => {
    const m = await resolveDeal(
      mail({ toEmails: ['ant@wearekept.co.uk'], postcodes: ['M14 5AB'] }),
      MAILBOX,
      noLookups
    );
    expect(m.accepted).toBe(false);
  });

  test('we write to a surveyor about a home: the postcode keeps it', async () => {
    const m = await resolveDeal(
      mail({ toEmails: ['surveys@firm.example'], postcodes: ['M14 5AB'] }),
      MAILBOX,
      lookups({ dealsByPostcode: async () => [deal('deal-1')] })
    );
    expect(m).toEqual({
      accepted: true,
      dealId: 'deal-1',
      matchedBy: 'postcode',
    });
  });

  test('one solicitor on two purchases: kept, and left for a person', async () => {
    const m = await resolveDeal(
      mail(fromJane),
      MAILBOX,
      lookups({
        dealsByParticipant: async () => [deal('a'), deal('b', 'SW1A 1AA')],
        // A postcode match outside that pair must not be used either.
        dealsByPostcode: async () => [deal('c')],
      })
    );
    expect(m).toEqual({ accepted: true, dealId: null, matchedBy: null });
  });

  test('…unless the email names the property', async () => {
    const m = await resolveDeal(
      mail({ ...fromJane, postcodes: ['SW1A 1AA'] }),
      MAILBOX,
      lookups({
        dealsByParticipant: async () => [deal('a'), deal('b', 'SW1A 1AA')],
      })
    );
    expect(m).toMatchObject({ dealId: 'b', matchedBy: 'participant' });
  });

  test('a conversation waiting for a deal keeps collecting its replies', async () => {
    const m = await resolveDeal(
      mail({ fromEmail: 'tom@agency.example', toEmails: [MAILBOX] }),
      MAILBOX,
      lookups({ threadDeal: async () => ({ dealId: null }) })
    );
    expect(m).toEqual({ accepted: true, dealId: null, matchedBy: null });
  });

  test('the Kept/Log label keeps anything, even a note between colleagues', async () => {
    const m = await resolveDeal(
      mail({ toEmails: ['ant@wearekept.co.uk'], explicit: true }),
      MAILBOX,
      lookups()
    );
    expect(m).toEqual({ accepted: true, dealId: null, matchedBy: null });
  });

  test('…and a postcode on a labelled email files it', async () => {
    const m = await resolveDeal(
      mail({
        fromEmail: 'tom@agency.example',
        toEmails: [MAILBOX],
        postcodes: ['M14 5AB'],
        explicit: true,
      }),
      MAILBOX,
      lookups({ dealsByPostcode: async () => [deal('deal-1')] })
    );
    expect(m).toMatchObject({ dealId: 'deal-1', matchedBy: 'postcode' });
  });
});

// ───────────────────────────────────────────────────────────────────────────

/**
 * An in-memory mailbox and database for whole-run tests. Pass `db` from
 * another world to read a second Kept mailbox into the same database.
 */
const world = (
  messages: MessageInput[],
  deals: DealRow[] = [DEAL],
  opts: {
    mailbox?: string;
    db?: { saved: MailToSave[]; removedMessageIds: Set<string> };
  } = {}
) => {
  const inbox = new Map(messages.map((m) => [m.id, full(m)]));
  const saved: MailToSave[] = opts.db?.saved ?? [];
  const removedMessageIds = opts.db?.removedMessageIds ?? new Set<string>();
  const removed = new Set<string>();
  const cards: string[] = [];
  const calls = { meta: [] as string[], full: [] as string[] };
  const labelled = new Map<string, string[]>();
  const failOn = new Set<string>();

  const gmail: GmailPort = {
    listIds: async ({ q, labelId, max }) =>
      Array.from(inbox.values())
        .filter((m) =>
          labelId
            ? (m.labelIds ?? []).includes(labelId)
            : q !== undefined && !q.startsWith('NOTHING')
        )
        // Gmail lists newest first.
        .sort((a, b) => Number(b.internalDate) - Number(a.internalDate))
        .slice(0, max)
        .map((m) => ({ id: m.id, threadId: m.threadId })),
    getMeta: async (id) => {
      calls.meta.push(id);
      if (failOn.has(id)) {
        throw new Error('Google API 500');
      }
      return meta(inbox.get(id) as GmailMessage);
    },
    getFull: async (id) => {
      calls.full.push(id);
      return inbox.get(id) as GmailMessage;
    },
    addLabel: async (id, labelId) => {
      labelled.set(id, [...(labelled.get(id) ?? []), labelId]);
    },
  };

  const store: StorePort = {
    knownGmailIds: async (ids) =>
      new Set(
        ids.filter(
          (id) => removed.has(id) || saved.some((s) => s.gmailId === id)
        )
      ),
    knownMessageIds: async (ids) =>
      new Set(
        ids.filter(
          (id) =>
            removedMessageIds.has(id) || saved.some((s) => s.messageId === id)
        )
      ),
    lookups: {
      threadDeal: async (threadKey) => {
        const rows = saved.filter((s) => s.threadKey === threadKey);
        return rows.find((r) => r.dealId !== null) ?? rows[0] ?? null;
      },
      dealsByParticipant: async (emails) =>
        deals
          .filter((d) => emails.includes(d.sellerEmail))
          .map((d) => ({ id: d.id, postcode: d.postcode, open: true })),
      dealsByPostcode: async (postcodes) =>
        deals
          .filter((d) => postcodes.includes(d.postcode))
          .map((d) => ({ id: d.id, postcode: d.postcode, open: true })),
    },
    save: async (m) => {
      if (saved.some((s) => s.gmailId === m.gmailId)) {
        return false;
      }
      saved.push(m);
      return true;
    },
    adoptThread: async (threadKey, dealId) => {
      for (const s of saved) {
        if (s.threadKey === threadKey && s.dealId === null) {
          s.dealId = dealId;
        }
      }
    },
    raiseUnfiledCard: async (m) => {
      if (!cards.includes(m.threadKey)) {
        cards.push(m.threadKey);
      }
    },
  };

  const run = (
    over: { query?: string; max?: number; onlyDealId?: string } = {}
  ) =>
    runDealMailImport({
      gmail,
      store,
      mailbox: opts.mailbox ?? MAILBOX,
      labelIds: LABELS,
      query: over.query ?? 'after:0',
      max: over.max ?? 500,
      onlyDealId: over.onlyDealId,
      now: NOW,
    });

  return {
    run,
    saved,
    removed,
    removedMessageIds,
    cards,
    calls,
    labelled,
    failOn,
    inbox,
    db: { saved, removedMessageIds },
  };
};

type DealRow = { id: string; postcode: string; sellerEmail: string };
const DEAL: DealRow = {
  id: 'deal-1',
  postcode: 'M14 5AB',
  sellerEmail: SELLER,
};

describe('an import run', () => {
  test('keeps deal mail, ignores the rest, and never opens what it ignores', async () => {
    const w = world([
      { id: 'deal', to: SELLER, body: 'Thank you for your time today.' },
      { id: 'lunch', to: 'friend@example.org', body: 'Lunch on Friday?' },
      { id: 'news', from: 'news@shop.example', to: MAILBOX, body: 'Sale!' },
      { id: 'note', to: 'ant@wearekept.co.uk', body: 'Thoughts on M14 5AB?' },
    ]);
    const result = await w.run();

    expect(result).toMatchObject({
      scanned: 4,
      kept: 1,
      ignored: 3,
      errors: 0,
    });
    expect(w.saved.map((s) => s.gmailId)).toEqual(['deal']);
    expect(w.saved[0]).toMatchObject({
      dealId: 'deal-1',
      matchedBy: 'participant',
      direction: 'outbound',
      bodyText: 'Thank you for your time today.',
    });
    // Headers were read for all four. The BODY only for the one kept.
    expect(w.calls.meta.sort()).toEqual(['deal', 'lunch', 'news', 'note']);
    expect(w.calls.full).toEqual(['deal']);
    // The founder can see in Gmail that it was taken.
    expect(w.labelled.get('deal')).toEqual([LABELS.logged]);
    expect(w.labelled.has('lunch')).toBe(false);
  });

  test('a conversation: our email, then the reply from a new address, both on the deal', async () => {
    const w = world([
      // Listed newest first by Gmail; the run must store the older one first.
      {
        id: 'reply',
        threadId: 'T1',
        from: 'surveys@firm.example',
        to: MAILBOX,
        body: 'Happy to. £450.',
        at: '2026-11-22T15:00:00Z',
      },
      {
        id: 'ask',
        threadId: 'T1',
        to: 'surveys@firm.example',
        body: 'Could you quote for a survey of 12 Acacia Avenue, M14 5AB?',
        at: '2026-11-22T09:00:00Z',
      },
    ]);
    const result = await w.run();
    expect(result).toMatchObject({ kept: 2, ignored: 0 });
    expect(w.saved.map((s) => [s.gmailId, s.matchedBy])).toEqual([
      ['ask', 'postcode'],
      ['reply', 'thread'],
    ]);
  });

  test('a postcode far down the body still files an email we are keeping', async () => {
    const w = world(
      [
        {
          id: 'm1',
          from: SELLER,
          to: MAILBOX,
          body: `${'Long preamble. '.repeat(30)}The property is SW1A 1AA.`,
        },
      ],
      [DEAL, { id: 'deal-2', postcode: 'SW1A 1AA', sellerEmail: SELLER }]
    );
    await w.run();
    expect(w.saved[0]).toMatchObject({ dealId: 'deal-2' });
  });

  test('a second run stores nothing twice and reads nothing again', async () => {
    const w = world([{ id: 'deal', to: SELLER }]);
    await w.run();
    w.calls.meta.length = 0;
    const second = await w.run();
    expect(second).toMatchObject({ scanned: 0, kept: 0 });
    expect(w.saved).toHaveLength(1);
    expect(w.calls.meta).toEqual([]);
  });

  test('an email a founder removed is not brought back', async () => {
    const w = world([{ id: 'deal', to: SELLER }]);
    w.removed.add('deal');
    const result = await w.run();
    expect(result).toMatchObject({ scanned: 0, kept: 0 });
    expect(w.saved).toHaveLength(0);
  });

  test('drafts and spam are never read past their labels', async () => {
    const w = world([
      { id: 'draft', to: SELLER, labelIds: ['DRAFT'] },
      { id: 'spam', from: SELLER, to: MAILBOX, labelIds: ['SPAM'] },
    ]);
    const result = await w.run();
    expect(result).toMatchObject({ scanned: 0, kept: 0 });
    expect(w.calls.full).toEqual([]);
  });

  test('the Kept/Log label keeps an email no rule would: stored, waiting, one card', async () => {
    const w = world([
      {
        id: 'agent',
        threadId: 'T7',
        from: 'tom@agency.example',
        to: MAILBOX,
        body: 'Is it still for sale?',
        labelIds: ['INBOX', LABELS.log],
        at: '2020-01-01T00:00:00Z',
      },
    ]);
    // Not in the "since" search at all: found through the label.
    const result = await w.run({ query: 'NOTHING' });
    expect(result).toMatchObject({ kept: 0, unfiled: 1 });
    expect(w.saved[0]).toMatchObject({ dealId: null, direction: 'inbound' });
    expect(w.cards).toEqual(['gmail:T7']);
  });

  test('…and the conversation files itself once a later email names the deal', async () => {
    const w = world([
      {
        id: 'agent',
        threadId: 'T7',
        from: 'tom@agency.example',
        to: MAILBOX,
        labelIds: ['INBOX', LABELS.log],
        at: '2026-11-20T10:00:00Z',
      },
    ]);
    await w.run();
    w.inbox.set(
      'ours',
      full({
        id: 'ours',
        threadId: 'T7',
        to: 'tom@agency.example',
        body: 'Yes. It is 12 Acacia Avenue, M14 5AB.',
        at: '2026-11-21T10:00:00Z',
      })
    );
    const second = await w.run();
    expect(second).toMatchObject({ kept: 1, unfiled: 0 });
    expect(w.saved.map((s) => s.dealId)).toEqual(['deal-1', 'deal-1']);
  });

  test('one unreadable message does not stop the run', async () => {
    const w = world([
      { id: 'bad', to: SELLER },
      { id: 'good', to: SELLER },
    ]);
    w.failOn.add('bad');
    const result = await w.run();
    expect(result).toMatchObject({ kept: 1, errors: 1 });
    expect(w.saved.map((s) => s.gmailId)).toEqual(['good']);
  });

  test('reports when it hit its limit', async () => {
    const w = world([
      { id: 'a', to: SELLER, at: '2026-11-22T10:00:00Z' },
      { id: 'b', to: SELLER, at: '2026-11-22T11:00:00Z' },
    ]);
    expect((await w.run({ max: 1 })).capped).toBe(true);
    expect((await world([{ id: 'a', to: SELLER }]).run()).capped).toBe(false);
  });
});

describe('more than one Kept mailbox', () => {
  const JO = 'jo@wearekept.co.uk';
  // One email from the seller to Sam and Jo: a different Gmail id in each
  // mailbox, the same Message-ID.
  const toBoth = {
    from: SELLER,
    to: `${MAILBOX}, ${JO}`,
    messageId: 'CAF-seller-1@mail.example.com',
  };

  test('an email in two mailboxes is stored once, from the first', async () => {
    const sam = world([{ id: 'sam-1', ...toBoth }]);
    const jo = world([{ id: 'jo-1', ...toBoth }], [DEAL], {
      mailbox: JO,
      db: sam.db,
    });
    expect(await sam.run()).toMatchObject({ kept: 1 });
    expect(await jo.run()).toMatchObject({ scanned: 0, kept: 0, errors: 0 });
    expect(sam.saved.map((s) => [s.gmailId, s.mailbox])).toEqual([
      ['sam-1', MAILBOX],
    ]);
    // Jo's copy: headers read to see the Message-ID, body never opened.
    expect(jo.calls.full).toEqual([]);
  });

  test('records the mailbox an email was read from', async () => {
    const jo = world([{ id: 'jo-1', from: SELLER, to: JO }], [DEAL], {
      mailbox: JO,
    });
    await jo.run();
    expect(jo.saved[0]).toMatchObject({ mailbox: JO, direction: 'inbound' });
  });

  test('an email removed from the log does not come back from another mailbox', async () => {
    const jo = world([{ id: 'jo-1', ...toBoth }], [DEAL], { mailbox: JO });
    jo.removedMessageIds.add(toBoth.messageId);
    expect(await jo.run()).toMatchObject({ scanned: 0, kept: 0 });
    expect(jo.saved).toEqual([]);
  });

  test('two copies in the same mailbox are stored once', async () => {
    const w = world([
      { id: 'copy-1', ...toBoth, at: '2026-11-22T10:00:00Z' },
      { id: 'copy-2', ...toBoth, at: '2026-11-22T10:00:01Z' },
    ]);
    await w.run();
    expect(w.saved.map((s) => s.gmailId)).toEqual(['copy-1']);
  });

  test('a note between two Kept people is still ignored in either mailbox', async () => {
    const note = {
      from: `Sam <${MAILBOX}>`,
      to: JO,
      body: 'Popped round to M14 5AB, all fine.',
    };
    const jo = world([{ id: 'jo-1', ...note }], [DEAL], { mailbox: JO });
    const sam = world([{ id: 'sam-1', ...note }]);
    expect(await jo.run()).toMatchObject({ kept: 0, unfiled: 0, ignored: 1 });
    expect(await sam.run()).toMatchObject({ kept: 0, unfiled: 0, ignored: 1 });
  });
});

describe('which accounts can be added as a mailbox', () => {
  const MAIN = 'sam@wearekept.co.uk';

  test('a colleague on the Kept domain', () => {
    expect(mailboxRefusal('jo@wearekept.co.uk', MAIN)).toBeNull();
    expect(mailboxRefusal('Hello@WeAreKept.co.uk', MAIN)).toBeNull();
  });

  test('not before the main account is connected', () => {
    expect(mailboxRefusal('jo@wearekept.co.uk', null)).toBe('no_main');
  });

  test('not the main account again', () => {
    expect(mailboxRefusal('SAM@wearekept.co.uk', MAIN)).toBe('is_main');
  });

  test('not another domain, a personal Gmail, or a lookalike', () => {
    expect(mailboxRefusal('jo@gmail.com', MAIN)).toBe('other_domain');
    expect(mailboxRefusal('jo@agency.example', MAIN)).toBe('other_domain');
    expect(mailboxRefusal('jo@wearekept.co.uk.evil.example', MAIN)).toBe(
      'other_domain'
    );
    expect(mailboxRefusal('jo@sub.wearekept.co.uk', MAIN)).toBe('other_domain');
  });
});

describe('a deal’s history import', () => {
  const OTHER: DealRow = {
    id: 'deal-2',
    postcode: 'SW1A 1AA',
    sellerEmail: 'solicitor@shared.example',
  };
  const SHARED: DealRow = { ...DEAL, sellerEmail: 'solicitor@shared.example' };

  test('keeps what belongs to this deal and leaves what could be another’s', async () => {
    const w = world(
      [
        { id: 'mine', from: SELLER, to: MAILBOX },
        // The same solicitor is on two deals and the email names neither.
        { id: 'unclear', from: 'solicitor@shared.example', to: MAILBOX },
      ],
      [DEAL, SHARED, OTHER]
    );
    const result = await w.run({ onlyDealId: 'deal-1' });
    expect(result).toMatchObject({ kept: 1, unfiled: 0, ignored: 1 });
    expect(w.saved.map((s) => s.gmailId)).toEqual(['mine']);
    // No "needs a deal" card for mail nobody asked to log.
    expect(w.cards).toEqual([]);
  });
});

describe('the Gmail searches', () => {
  test('since a moment, in epoch seconds, without drafts or chats', () => {
    expect(sinceQuery(new Date('2026-11-23T12:00:00Z'))).toBe(
      'after:1795435200 -in:drafts -in:chats'
    );
  });

  test('a deal’s people: to, from or copying any of them', () => {
    expect(dealHistoryQuery([' Jane@Example.com ', 'p@law.example'], 180)).toBe(
      '{from:jane@example.com to:jane@example.com cc:jane@example.com from:p@law.example to:p@law.example cc:p@law.example} newer_than:180d -in:drafts -in:chats'
    );
  });

  test('nothing searchable means no search, not a search for everything', () => {
    expect(dealHistoryQuery([], 180)).toBe('');
    expect(dealHistoryQuery(['not an address', 'a@b} OR {from:x'], 180)).toBe(
      ''
    );
  });
});
