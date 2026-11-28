import {
  classifyLeadSource,
  leadChannelLabel,
  leadSourceColumns,
  readLeadSource,
  sanitizeLeadSource,
} from '@repo/analytics/lead-source';
import { describe, expect, it } from 'vitest';
import { summariseLeadSources } from '../lib/lead-sources';

/**
 * Mirrors PRIVATE_PATHS in apps/web/components/cookie-consent.tsx without
 * importing a 'use client' component (same stand-in as posthog-redact.test).
 */
const PRIVATE = ['/track', '/viewing', '/save-the-sale'];
const isPrivatePath = (p: string) =>
  PRIVATE.some((x) => p === x || p.startsWith(`${x}/`));

const SITE = 'https://www.wearekept.co.uk';
const read = (path: string, referrer = '') =>
  readLeadSource({ url: `${SITE}${path}`, referrer, isPrivatePath });
const channelOf = (path: string, referrer = '') =>
  classifyLeadSource(read(path, referrer));

describe('reading the source off the landing page', () => {
  it('works with nothing changed in the ad accounts: Google', () => {
    // What Google's auto-tagging adds on its own to every ad click.
    const s = read(
      '/sell?gad_source=1&gad_campaignid=22334455667&gclid=Cj0KCQiA_secret',
      'https://www.google.com/'
    );
    expect(s).toEqual({
      clickIdKind: 'gclid',
      adCampaignId: '22334455667',
      landingPath: '/sell',
      referrerHost: 'google.com',
    });
    expect(classifyLeadSource(s)).toBe('google_ads');
  });

  it('works with nothing changed in the ad accounts: Meta', () => {
    const s = read('/sell?fbclid=IwAR0_secret', 'https://l.facebook.com/');
    expect(s.clickIdKind).toBe('fbclid');
    // Not called an advert: Meta puts fbclid on post clicks too.
    expect(classifyLeadSource(s)).toBe('meta');
  });

  it('never keeps the click id itself, or the rest of the query string', () => {
    const s = read('/sell?gclid=Cj0KCQiA_secret&email=a%40b.com&foo=bar');
    expect(JSON.stringify(s)).not.toContain('Cj0KCQiA_secret');
    expect(JSON.stringify(s)).not.toContain('a@b.com');
    expect(s.landingPath).toBe('/sell');
  });

  it('cuts a private landing URL back to a stub', () => {
    expect(read('/track/tok_abc123?utm_source=email').landingPath).toBe(
      '/track/[private]'
    );
    expect(read('/save-the-sale?address=12+Acacia+Avenue').landingPath).toBe(
      '/save-the-sale/[private]'
    );
  });

  it('reads UTM tags, trimmed and capped', () => {
    const s = read(
      `/probate?utm_source=meta&utm_medium=paid_social&utm_campaign=${'x'.repeat(300)}&utm_content=%20Inherited%20home%20video%20`
    );
    expect(s.utmSource).toBe('meta');
    expect(s.utmCampaign).toHaveLength(120);
    expect(s.utmContent).toBe('Inherited home video');
  });

  it('marks a same-site referrer as a lost origin, not as direct', () => {
    const s = read('/sell', `${SITE}/probate`);
    expect(s).toEqual({ landingPath: '/sell', internal: true });
    expect(classifyLeadSource(s)).toBe('unknown');
    // www and bare domain are the same site.
    expect(read('/sell', 'https://wearekept.co.uk/').internal).toBe(true);
  });
});

describe('one channel per enquiry', () => {
  it('names the platform when the ad link is tagged as paid', () => {
    expect(
      channelOf('/sell?utm_source=facebook&utm_medium=paid_social&fbclid=x')
    ).toBe('meta_ads');
    expect(channelOf('/sell?utm_source=ig&utm_medium=cpc')).toBe('meta_ads');
    expect(channelOf('/sell?utm_source=google&utm_medium=cpc')).toBe(
      'google_ads'
    );
    expect(channelOf('/sell?utm_source=bing&utm_medium=cpc')).toBe(
      'microsoft_ads'
    );
    expect(channelOf('/sell?utm_source=rightmove&utm_medium=display')).toBe(
      'paid_other'
    );
  });

  it("trusts Google's own click marker over a mislabelled tag", () => {
    expect(
      channelOf('/sell?utm_source=newsletter&utm_medium=email&gclid=x')
    ).toBe('google_ads');
  });

  it('tells unpaid search, social, email, AI and other sites apart', () => {
    expect(channelOf('/sell', 'https://www.google.co.uk/')).toBe(
      'organic_search'
    );
    expect(channelOf('/sell', 'https://duckduckgo.com/')).toBe(
      'organic_search'
    );
    expect(channelOf('/sell', 'https://www.instagram.com/')).toBe('meta');
    expect(channelOf('/sell', 'https://www.linkedin.com/feed/')).toBe('social');
    expect(channelOf('/sell', 'https://mail.google.com/')).toBe('email');
    expect(channelOf('/sell', 'https://gemini.google.com/')).toBe(
      'ai_assistant'
    );
    expect(channelOf('/sell', 'https://chatgpt.com/')).toBe('ai_assistant');
    expect(channelOf('/sell', 'https://www.moneysavingexpert.com/x')).toBe(
      'referral'
    );
    expect(channelOf('/sell')).toBe('direct');
  });

  it("recognises the ChatGPT plugin's own links", () => {
    // apps/plugin/lib/links.ts
    expect(
      channelOf(
        '/sell?utm_source=chatgpt&utm_medium=plugin&utm_campaign=sale_routes'
      )
    ).toBe('ai_assistant');
  });

  it('files any other tagged link as a tagged link', () => {
    expect(channelOf('/sell?utm_source=leaflet&utm_medium=print')).toBe(
      'tagged_link'
    );
  });

  it('does not mistake look-alike hosts for a search engine', () => {
    expect(channelOf('/sell', 'https://notgoogle.com/')).toBe('referral');
    expect(channelOf('/sell', 'https://google.evil.example/')).toBe('referral');
  });
});

describe('cleaning what the browser posts', () => {
  it('returns undefined for anything that is not an object', () => {
    for (const bad of [undefined, null, 'x', 7, [], true]) {
      expect(sanitizeLeadSource(bad)).toBeUndefined();
    }
  });

  it('keeps known fields and drops the rest, without rejecting', () => {
    expect(
      sanitizeLeadSource({
        utmSource: 'google',
        utmCampaign: 12,
        clickIdKind: 'gclid',
        adCampaignId: '123abc',
        landingPath: '/sell?utm_source=x#top',
        referrerHost: 'Google.com',
        internal: 'yes',
        gclid: 'Cj0KCQiA_secret',
        contactEmail: 'a@b.com',
      })
    ).toEqual({
      utmSource: 'google',
      clickIdKind: 'gclid',
      landingPath: '/sell',
      referrerHost: 'google.com',
    });
  });

  it('rejects a click-id kind we do not know and a path that is not a path', () => {
    const s = sanitizeLeadSource({
      clickIdKind: 'evilclid',
      landingPath: 'https://evil.example/x',
      referrerHost: 'bad host/with path',
    });
    expect(s).toEqual({});
    // Nothing known still counts as a visit we saw: it is "direct".
    expect(leadSourceColumns(s ?? {}).channel).toBe('direct');
  });

  it("a paid tag with Meta's click marker is a Meta advert, whatever the source says", () => {
    // Meta's own placement names: "an" (Audience Network), "msg" (Messenger).
    expect(channelOf('/sell?utm_source=an&utm_medium=paid&fbclid=x')).toBe(
      'meta_ads'
    );
  });

  it('round-trips a read source into the row we save', () => {
    const posted = sanitizeLeadSource(
      read(
        '/probate?utm_source=meta&utm_medium=paid_social&utm_campaign=Leads&utm_content=Inherited+home&fbclid=x'
      )
    );
    expect(posted).toBeDefined();
    const cols = leadSourceColumns(posted ?? {});
    expect(cols).toMatchObject({
      channel: 'meta_ads',
      utmCampaign: 'Leads',
      utmContent: 'Inherited home',
      clickIdKind: 'fbclid',
      landingPath: '/probate',
    });
  });
});

describe('labels', () => {
  it('labels a stored channel and returns null for none or junk', () => {
    expect(leadChannelLabel('google_ads')).toBe('Google Ads');
    expect(leadChannelLabel('meta')).toBe('Facebook / Instagram');
    expect(leadChannelLabel(null)).toBeNull();
    expect(leadChannelLabel('public_web')).toBeNull();
  });
});

describe('the "Where enquiries came from" summary', () => {
  const row = (
    channel: string,
    status: string,
    extra: Partial<{
      utmCampaign: string;
      utmContent: string;
      adCampaignId: string;
    }> = {}
  ) => ({
    channel,
    status,
    utmCampaign: extra.utmCampaign ?? null,
    utmContent: extra.utmContent ?? null,
    adCampaignId: extra.adCampaignId ?? null,
  });

  it('counts enquiries, accepted offers and deals per source', () => {
    // Seven enquiries in the window: four with a source we know, one with
    // a channel this code does not know, two with none saved at all.
    const s = summariseLeadSources(
      [
        row('google_ads', 'quoted'),
        row('google_ads', 'accepted'),
        row('google_ads', 'converted_to_deal'),
        row('meta', 'processing'),
        row('some_old_channel', 'quoted'),
      ],
      7
    );
    expect(s.channels).toEqual([
      {
        channel: 'google_ads',
        label: 'Google Ads',
        enquiries: 3,
        // A deal was an accepted offer first: it counts in both.
        accepted: 2,
        deals: 1,
      },
      {
        channel: 'meta',
        label: 'Facebook / Instagram',
        enquiries: 1,
        accepted: 0,
        deals: 0,
      },
    ]);
    expect(s.notRecorded).toBe(3);
    expect(s.adverts).toEqual([]);
  });

  it('breaks out campaign and advert when the link was tagged', () => {
    const s = summariseLeadSources(
      [
        row('meta_ads', 'quoted', {
          utmCampaign: 'Leads',
          utmContent: 'Video A',
        }),
        row('meta_ads', 'accepted', {
          utmCampaign: 'Leads',
          utmContent: 'Video A',
        }),
        row('meta_ads', 'quoted', {
          utmCampaign: 'Leads',
          utmContent: 'Image B',
        }),
        row('google_ads', 'quoted', { adCampaignId: '2233' }),
      ],
      4
    );
    expect(s.notRecorded).toBe(0);
    expect(s.adverts.map((a) => [a.campaign, a.advert, a.enquiries])).toEqual([
      ['Leads', 'Video A', 2],
      ['Leads', 'Image B', 1],
      ['Campaign 2233', null, 1],
    ]);
    expect(s.adverts[0]?.accepted).toBe(1);
  });
});
