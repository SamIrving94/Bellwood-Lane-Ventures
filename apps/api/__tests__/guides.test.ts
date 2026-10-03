import { describe, expect, test } from 'vitest';
import {
  candidateQuestions,
  EVERGREEN_QUESTIONS,
  LANDING_ROUTES,
} from '../app/cron/_lib/guides/evergreen-questions';
import {
  consolidate,
  parseFeed,
  parseRedditListing,
} from '../app/cron/_lib/guides/signals';
import { slugify } from '../app/cron/_lib/guides/slug';

describe('evergreen questions', () => {
  test('keys are unique and stable-looking', () => {
    const keys = EVERGREEN_QUESTIONS.map((q) => q.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(k).toMatch(/^[a-z0-9-]+$/);
  });

  test('every landing route is a live public page', () => {
    const live = new Set<string>(LANDING_ROUTES);
    for (const q of EVERGREEN_QUESTIONS) {
      expect(live.has(q.landing), `${q.key} → ${q.landing}`).toBe(true);
    }
  });

  test('there is a year of weekly guides before the list repeats', () => {
    expect(EVERGREEN_QUESTIONS.length).toBeGreaterThanOrEqual(20);
  });

  test('no question carries a service-level figure', () => {
    for (const q of EVERGREEN_QUESTIONS) {
      expect(q.question).not.toMatch(/24[- ]hour|4[- ]hour|8 weeks/i);
    }
  });
});

describe('candidateQuestions rotation', () => {
  test('excludes questions written in the window, keeps list order', () => {
    const first = EVERGREEN_QUESTIONS[0].key;
    const second = EVERGREEN_QUESTIONS[1].key;
    const out = candidateQuestions([first]);
    expect(out[0].key).toBe(second);
    expect(out.find((q) => q.key === first)).toBeUndefined();
  });

  test('when every question is recent, the oldest comes back first', () => {
    // recentKeys is newest first; the last entry is the oldest guide.
    const all = EVERGREEN_QUESTIONS.map((q) => q.key);
    const out = candidateQuestions(all);
    expect(out.length).toBe(all.length);
    expect(out[0].key).toBe(all[all.length - 1]);
  });
});

describe('parseFeed', () => {
  test('reads RSS 2.0 items with CDATA titles and HTML descriptions', () => {
    const xml = `<?xml version="1.0"?><rss><channel><title>PIE</title>
      <item>
        <title><![CDATA[Fall-throughs rise as rates bite &#8211; report]]></title>
        <link>https://example.com/a</link>
        <pubDate>Mon, 15 Sep 2026 08:00:00 +0000</pubDate>
        <description><![CDATA[<p>One in <b>three</b> sales&nbsp;collapsed.</p>]]></description>
      </item>
      <item><title>No link</title></item>
    </channel></rss>`;
    const out = parseFeed(xml, 'PIE');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      kind: 'rss',
      source: 'PIE',
      title: 'Fall-throughs rise as rates bite – report',
      url: 'https://example.com/a',
      excerpt: 'One in three sales collapsed.',
    });
    expect(out[0].publishedAt).toBe('2026-09-15T08:00:00.000Z');
  });

  test('reads Atom entries with self-closing link hrefs', () => {
    const xml = `<feed xmlns="http://www.w3.org/2005/Atom">
      <entry>
        <title>HM Land Registry: price paid data update</title>
        <link rel="alternate" href="https://www.gov.uk/x"/>
        <updated>2026-09-14T09:30:00Z</updated>
        <summary>Monthly update.</summary>
      </entry>
    </feed>`;
    const out = parseFeed(xml, 'HMLR');
    expect(out).toHaveLength(1);
    expect(out[0].url).toBe('https://www.gov.uk/x');
    expect(out[0].publishedAt).toBe('2026-09-14T09:30:00.000Z');
  });

  test('returns nothing for a page that is not a feed', () => {
    expect(parseFeed('<html><body>403</body></html>', 'x')).toEqual([]);
  });
});

describe('parseRedditListing', () => {
  const listing = {
    data: {
      children: [
        {
          data: {
            title: 'Buyer pulled out a week before exchange',
            permalink: '/r/HousingUK/comments/abc/buyer_pulled_out/',
            selftext: 'We were due to exchange Friday.  Now what?',
            ups: 40,
            num_comments: 22,
            created_utc: 1789000000,
            subreddit: 'HousingUK',
          },
        },
        {
          data: {
            title: 'nsfw thing',
            permalink: '/r/HousingUK/comments/def/x/',
            over_18: true,
          },
        },
      ],
    },
  };

  test('maps posts to signals and drops over-18 items', () => {
    const out = parseRedditListing(listing, 'HousingUK');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      kind: 'reddit',
      source: 'r/HousingUK',
      url: 'https://www.reddit.com/r/HousingUK/comments/abc/buyer_pulled_out/',
      excerpt: 'We were due to exchange Friday. Now what?',
      engagement: 62,
    });
  });

  test('rejects an unexpected shape instead of throwing', () => {
    expect(parseRedditListing({ error: 403 }, 'HousingUK')).toEqual([]);
    expect(parseRedditListing('<html>', 'HousingUK')).toEqual([]);
  });
});

describe('consolidate', () => {
  test('dedupes by url, newest first, capped', () => {
    const mk = (url: string, at?: string) => ({
      kind: 'rss' as const,
      source: 's',
      title: url,
      url,
      publishedAt: at,
    });
    const out = consolidate(
      [
        mk('https://a', '2026-09-10T00:00:00Z'),
        mk('https://b', '2026-09-12T00:00:00Z'),
        mk('https://a', '2026-09-10T00:00:00Z'),
        mk('https://c'),
      ],
      2
    );
    expect(out.map((s) => s.url)).toEqual(['https://b', 'https://a']);
  });
});

describe('slugify', () => {
  test('makes a URL-safe slug and strips apostrophes', () => {
    expect(slugify("What happens to a house after probate's granted?")).toBe(
      'what-happens-to-a-house-after-probates-granted'
    );
  });
  test('caps length without a trailing hyphen', () => {
    const s = slugify(`${'a'.repeat(50)} ${'b'.repeat(50)}`);
    expect(s.length).toBeLessThanOrEqual(72);
    expect(s.endsWith('-')).toBe(false);
  });
});
