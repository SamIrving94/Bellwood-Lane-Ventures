import {
  bareAddress,
  htmlToText,
  isOwnAddress,
  replySubject,
} from '@repo/email/addresses';
import { describe, expect, it } from 'vitest';

describe('bareAddress', () => {
  it('pulls the address out of a display-name form', () => {
    expect(bareAddress('Anthony Taylor <Anthony@Example.co.uk>')).toBe(
      'anthony@example.co.uk'
    );
  });

  it('lower-cases a bare address', () => {
    expect(bareAddress(' Seller@Gmail.com ')).toBe('seller@gmail.com');
  });

  it('returns null rather than guessing', () => {
    expect(bareAddress('undisclosed-recipients:;')).toBeNull();
    expect(bareAddress('')).toBeNull();
    expect(bareAddress(undefined)).toBeNull();
  });
});

describe('isOwnAddress', () => {
  it('treats both our domains as internal', () => {
    expect(isOwnAddress('sam@wearekept.co.uk')).toBe(true);
    expect(isOwnAddress('Anthony@bellwoodslane.co.uk')).toBe(true);
  });

  it('does not match a lookalike domain', () => {
    expect(isOwnAddress('sam@notwearekept.co.uk')).toBe(false);
    expect(isOwnAddress('seller@gmail.com')).toBe(false);
  });
});

describe('replySubject', () => {
  it('adds Re: once', () => {
    expect(replySubject('Welcome to Kept')).toBe('Re: Welcome to Kept');
    expect(replySubject('RE: re: Welcome to Kept')).toBe('Re: Welcome to Kept');
  });

  it('copes with an empty subject', () => {
    expect(replySubject('')).toBe('Re: (no subject)');
  });
});

describe('htmlToText', () => {
  it('keeps the words and drops markup, styles and scripts', () => {
    const html =
      '<html><head><style>p{color:red}</style></head><body><p>Hello &amp; thanks</p><script>x()</script><div>Line two<br>Line three</div></body></html>';
    expect(htmlToText(html)).toBe('Hello & thanks\nLine two\nLine three');
  });
});
