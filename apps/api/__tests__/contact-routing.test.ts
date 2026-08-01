/**
 * The vendor-email hold rail (pipeline-outreach).
 *
 * CLAUDE.md: vendor-facing emails are NEVER auto-sent. `Contact.type` is a
 * bare String with no enum behind it, so the rail has to fail closed: only a
 * known business type may be auto-emailed, everything else is held.
 */

import { describe, expect, test } from 'vitest';
import {
  AUTO_SEND_CONTACT_TYPES,
  canAutoSend,
} from '../app/cron/_lib/contact-routing';

describe('canAutoSend', () => {
  test.each(AUTO_SEND_CONTACT_TYPES)('auto-sends to %s', (type) => {
    expect(canAutoSend(type)).toBe(true);
  });

  test('never auto-sends to a vendor', () => {
    expect(canAutoSend('vendor')).toBe(false);
    expect(canAutoSend('seller')).toBe(false);
    expect(canAutoSend('individual')).toBe(false);
  });

  test('holds an UNKNOWN type rather than sending', () => {
    // The old deny-list let every one of these through to auto-send.
    expect(canAutoSend('executor')).toBe(false);
    expect(canAutoSend('homeowner')).toBe(false);
    expect(canAutoSend('beneficiary')).toBe(false);
    expect(canAutoSend('landlord')).toBe(false);
  });

  test('holds an empty or missing type', () => {
    expect(canAutoSend('')).toBe(false);
    expect(canAutoSend('   ')).toBe(false);
    expect(canAutoSend(null)).toBe(false);
    expect(canAutoSend(undefined)).toBe(false);
  });

  test('normalises whitespace and casing before comparing', () => {
    // A trailing space used to defeat the check in both directions.
    expect(canAutoSend(' estate_agent ')).toBe(true);
    expect(canAutoSend('Estate_Agent')).toBe(true);
    expect(canAutoSend('Vendor ')).toBe(false);
    expect(canAutoSend(' SELLER')).toBe(false);
  });

  test('a near-miss on a business type is held, not sent', () => {
    expect(canAutoSend('estate agent')).toBe(false);
    expect(canAutoSend('estate-agent')).toBe(false);
    expect(canAutoSend('solicitors')).toBe(false);
  });
});
