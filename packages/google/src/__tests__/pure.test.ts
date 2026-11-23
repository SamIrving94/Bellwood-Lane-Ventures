import { describe, expect, it } from 'vitest';
import { classifySender, senderAddress } from '../classify';
import { decryptToken, encryptToken } from '../crypto';
import { buildRawMessage } from '../mime';
import { buildPartnerSheetCsv } from '../partner-sheet-rows';
import { addWorkingDays, londonDate, offerDueDate } from '../working-days';

const decode = (raw: string) => Buffer.from(raw, 'base64url').toString('utf8');

describe('token encryption', () => {
  it('round-trips with the same secret', () => {
    const stored = encryptToken('1//refresh-token', 'secret-a');
    expect(stored).not.toContain('refresh-token');
    expect(decryptToken(stored, 'secret-a')).toBe('1//refresh-token');
  });

  it('returns null for a different secret or a tampered value', () => {
    const stored = encryptToken('1//refresh-token', 'secret-a');
    expect(decryptToken(stored, 'secret-b')).toBeNull();
    expect(decryptToken(`${stored.slice(0, -2)}AA`, 'secret-a')).toBeNull();
    expect(decryptToken('not-a-token', 'secret-a')).toBeNull();
  });
});

describe('buildRawMessage', () => {
  it('builds a plain-text message with no From header', () => {
    const message = decode(
      buildRawMessage({
        to: 'seller@example.com',
        subject: 'Your home',
        text: 'Hello',
      })
    );
    expect(message).toContain('To: seller@example.com');
    expect(message).toContain('Subject: Your home');
    expect(message).not.toMatch(/^From:/m);
    expect(message).toContain(Buffer.from('Hello').toString('base64'));
  });

  it('cannot be made to add headers through a line break', () => {
    const message = decode(
      buildRawMessage({
        to: 'seller@example.com\r\nBcc: someone@else.com',
        subject: 'Hi\nBcc: third@else.com',
        text: 'x',
      })
    );
    expect(message).not.toMatch(/^Bcc:/m);
  });

  it('encodes a subject with a pound sign', () => {
    const message = decode(
      buildRawMessage({ to: 'a@b.co', subject: 'Offer of £250,000', text: 'x' })
    );
    expect(message).toContain('Subject: =?UTF-8?B?');
  });
});

describe('working days', () => {
  it('skips the weekend', () => {
    expect(addWorkingDays('2026-11-18', 2)).toBe('2026-11-20'); // Wed → Fri
    expect(addWorkingDays('2026-11-19', 2)).toBe('2026-11-23'); // Thu → Mon
    expect(addWorkingDays('2026-11-20', 2)).toBe('2026-11-24'); // Fri → Tue
    expect(addWorkingDays('2026-11-21', 2)).toBe('2026-11-24'); // Sat → Tue
  });

  it('uses the London date, not the UTC one', () => {
    // 23:30 UTC on 30 June is already 1 July in London (BST).
    const late = new Date('2026-06-30T23:30:00Z');
    expect(londonDate(late)).toBe('2026-07-01');
    expect(offerDueDate(late)).toBe('2026-07-03');
  });
});

describe('inbox classifier', () => {
  const known = {
    sellers: new Set(['seller@example.com']),
    solicitors: new Set(['law@firm.co.uk', 'seller@example.com']),
    agents: new Set(['agent@estate.co.uk']),
  };

  it('reads the address out of a From header', () => {
    expect(senderAddress('"Jo Bloggs" <Jo@Example.com>')).toBe(
      'jo@example.com'
    );
    expect(senderAddress('jo@example.com')).toBe('jo@example.com');
    expect(senderAddress('no address here')).toBeNull();
  });

  it('labels exact matches only, seller first', () => {
    expect(classifySender('Sam <SELLER@example.com>', known)).toBe('Seller');
    expect(classifySender('law@firm.co.uk', known)).toBe('Solicitor');
    expect(classifySender('agent@estate.co.uk', known)).toBe('Agent');
    // Same domain as a known solicitor is not a match.
    expect(classifySender('other@firm.co.uk', known)).toBeNull();
  });
});

describe('partner sheet', () => {
  const now = new Date('2026-11-22T09:00:00Z');
  const deal = {
    postcode: 'SE15 4QW',
    propertyType: 'semi_detached',
    bedrooms: 3,
    status: 'valuation',
    stageEnteredAt: new Date('2026-11-19T09:00:00Z'),
  };

  it('prints the outward code only, spaced or not', () => {
    const csv = buildPartnerSheetCsv(
      [
        deal,
        { ...deal, postcode: 'se154qw' },
        { ...deal, postcode: 'garbage' },
      ],
      now
    );
    expect(csv).not.toContain('4QW');
    expect(csv).not.toContain('garbage');
    expect(csv.split('\n')[1]).toBe('Valuation,SE15,semi detached,3,3');
    expect(csv.split('\n')[2]).toBe('Valuation,SE15,semi detached,3,3');
  });

  it('drops dead deals and defuses formula cells', () => {
    const csv = buildPartnerSheetCsv(
      [
        { ...deal, status: 'rejected' },
        { ...deal, propertyType: '=HYPERLINK("x")' },
      ],
      now
    );
    expect(csv.split('\n')).toHaveLength(2);
    expect(csv).toContain("'=HYPERLINK");
  });
});
