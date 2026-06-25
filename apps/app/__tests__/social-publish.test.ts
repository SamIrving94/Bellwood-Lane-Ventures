import { describe, expect, it } from 'vitest';
import {
  extractPostContent,
  platformsForActionType,
} from '../lib/social/post-mapping';

// Locks the pure mapping that decides what publishes where, and how post text
// is pulled from a marketing draft's metadata.

describe('platformsForActionType', () => {
  it('maps IG and LinkedIn draft types to platforms', () => {
    expect(platformsForActionType('approve_ig_post')).toEqual(['instagram']);
    expect(platformsForActionType('approve_linkedin_post')).toEqual([
      'linkedin',
    ]);
  });

  it('returns null for non-social drafts (blog, case study, ad copy, outreach)', () => {
    for (const t of [
      'approve_blog_draft',
      'approve_case_study',
      'approve_paid_ad_copy',
      'approve_solicitor_outreach',
      'approve_outreach_draft',
      'review_leads',
    ]) {
      expect(platformsForActionType(t)).toBeNull();
    }
  });
});

describe('extractPostContent', () => {
  it('reads an IG caption + image as media', () => {
    const c = extractPostContent({
      caption: 'Sold in 14 days in M40 — chain-break sorted.',
      imageUrl: 'https://example.com/a.jpg',
    });
    expect(c?.text).toContain('Sold in 14 days');
    expect(c?.mediaUrls).toEqual(['https://example.com/a.jpg']);
  });

  it('falls back to body / draft for LinkedIn', () => {
    expect(extractPostContent({ body: 'A LinkedIn post.' })?.text).toBe(
      'A LinkedIn post.'
    );
    expect(extractPostContent({ draft: 'Draft text.' })?.text).toBe(
      'Draft text.'
    );
  });

  it('prefers an explicit mediaUrls array', () => {
    const c = extractPostContent({
      caption: 'x',
      mediaUrls: ['https://e.com/1.jpg', 'https://e.com/2.jpg'],
    });
    expect(c?.mediaUrls).toHaveLength(2);
  });

  it('returns null when there is no usable text', () => {
    expect(extractPostContent({})).toBeNull();
    expect(extractPostContent(null)).toBeNull();
    expect(extractPostContent({ caption: '   ' })).toBeNull();
  });
});
