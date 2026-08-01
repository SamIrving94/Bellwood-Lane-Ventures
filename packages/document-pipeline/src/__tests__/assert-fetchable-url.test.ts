import { beforeEach, describe, expect, it } from 'vitest';
import { assertFetchableUrl } from '../probate-extract';

/**
 * `pdfUrl` arrives in an API payload, so this guard is the only thing between
 * an authenticated caller and a server-side fetch of their choosing.
 */
describe('assertFetchableUrl', () => {
  beforeEach(() => {
    process.env.PROBATE_PDF_ALLOWED_HOSTS = '';
  });

  it('allows the government publication sources we actually use', () => {
    expect(() =>
      assertFetchableUrl('https://www.thegazette.co.uk/notice/123.pdf')
    ).not.toThrow();
    expect(() =>
      assertFetchableUrl('https://probate.service.gov.uk/doc.pdf')
    ).not.toThrow();
    expect(() => assertFetchableUrl('https://gov.uk/x.pdf')).not.toThrow();
  });

  it('refuses plaintext http', () => {
    expect(() =>
      assertFetchableUrl('http://www.thegazette.co.uk/a.pdf')
    ).toThrow(/https/);
  });

  it('refuses cloud metadata and loopback', () => {
    expect(() =>
      assertFetchableUrl('https://169.254.169.254/latest/meta-data')
    ).toThrow(/not permitted/);
    expect(() => assertFetchableUrl('https://localhost/x.pdf')).toThrow(
      /not permitted/
    );
    expect(() =>
      assertFetchableUrl('https://metadata.google.internal/x')
    ).toThrow(/not permitted/);
  });

  it('refuses RFC1918 literals', () => {
    for (const host of ['10.0.0.5', '192.168.1.1', '172.16.0.1', '127.0.0.1']) {
      expect(() => assertFetchableUrl(`https://${host}/x.pdf`)).toThrow(
        /not permitted/
      );
    }
  });

  it('refuses hosts off the allowlist', () => {
    expect(() => assertFetchableUrl('https://evil.com/x.pdf')).toThrow(
      /allowlist/
    );
  });

  it('is not fooled by a suffix appended to an allowed host', () => {
    expect(() =>
      assertFetchableUrl('https://thegazette.co.uk.evil.com/x.pdf')
    ).toThrow(/allowlist/);
  });

  it('honours PROBATE_PDF_ALLOWED_HOSTS for deliberate additions', () => {
    expect(() => assertFetchableUrl('https://files.example.org/x.pdf')).toThrow(
      /allowlist/
    );
    process.env.PROBATE_PDF_ALLOWED_HOSTS = '.example.org';
    expect(() =>
      assertFetchableUrl('https://files.example.org/x.pdf')
    ).not.toThrow();
  });

  it('rejects malformed input', () => {
    expect(() => assertFetchableUrl('not a url')).toThrow(/valid URL/);
  });
});
