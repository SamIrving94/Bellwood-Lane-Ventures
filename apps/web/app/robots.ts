import { brand } from '@repo/brand';
import type { MetadataRoute } from 'next';

/**
 * Crawl rules. The gated and tokenised surfaces are listed here as well as
 * carrying their own noindex, so a crawler never has to fetch them to learn
 * that. The sitemap is how a newly published guide gets found.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/keyhole',
          '/portal',
          '/track',
          '/viewing',
          '/investors/',
          '/partners/',
          '/instant-offer/offer/',
        ],
      },
    ],
    sitemap: `${brand.url}/sitemap.xml`,
  };
}
