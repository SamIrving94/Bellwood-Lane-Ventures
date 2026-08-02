import { buildHoldingReply } from '@repo/email/holding-reply';
import { describe, expect, test } from 'vitest';

/**
 * The holding reply is the one vendor-facing message that sends without
 * founder review, so the "never quote a figure" rule is the only thing
 * keeping it safe. These tests exist to keep that rule enforced rather
 * than merely documented.
 */

describe('holding reply', () => {
  test('greets by first name only', () => {
    const { text } = buildHoldingReply({
      contactName: 'Margaret Whitfield',
      contactEmail: 'm@example.com',
    });
    expect(text).toContain('Hi Margaret,');
    expect(text).not.toContain('Whitfield');
  });

  test('falls back to a neutral greeting for unusable names', () => {
    const { text } = buildHoldingReply({
      contactName: 'X',
      contactEmail: 'x@example.com',
    });
    expect(text).toContain('Hi there,');
  });

  test('carries no figure, price or valuation', () => {
    const { subject, text } = buildHoldingReply({
      contactName: 'Alan Reid',
      contactEmail: 'a@example.com',
      propertyRef: 'M20 3QT',
    });
    const body = `${subject}\n${text}`;
    expect(body).not.toMatch(/[£$€]\s?\d/);
    // "72 hours" and the numbered steps are the only digits allowed through.
    expect(body).not.toMatch(/\b\d[\d,]*\s?(?:k\b|gbp\b|pounds\b)/i);
  });

  test('promises a call, never a price or a completion date', () => {
    const { text } = buildHoldingReply({
      contactName: 'Alan Reid',
      contactEmail: 'a@example.com',
      callbackHours: 12,
    });
    expect(text).toContain('call you within 12 hours');
    expect(text).not.toMatch(/we will (?:pay|offer|complete)/i);
  });

  test('refuses to render when a slot smuggles in a figure', () => {
    expect(() =>
      buildHoldingReply({
        contactName: 'Alan Reid',
        contactEmail: 'a@example.com',
        propertyRef: '12 Bell Lane — valued at £240,000',
      })
    ).toThrow(/never carry a price/);
  });

  test('includes the postcode when given, and stays clean without one', () => {
    const withRef = buildHoldingReply({
      contactName: 'Alan Reid',
      contactEmail: 'a@example.com',
      propertyRef: 'M20 3QT',
    });
    expect(withRef.subject).toContain('M20 3QT');
    expect(withRef.text).toContain('about M20 3QT');

    const withoutRef = buildHoldingReply({
      contactName: 'Alan Reid',
      contactEmail: 'a@example.com',
    });
    expect(withoutRef.subject).toBe("We've got your enquiry");
    expect(withoutRef.text).toContain('Thanks for getting in touch.');
  });
});
