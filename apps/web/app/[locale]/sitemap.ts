import { env } from '@/env';
import type { MetadataRoute } from 'next';

const protocol = env.VERCEL_PROJECT_PRODUCTION_URL?.startsWith('https')
  ? 'https'
  : 'http';
const base = new URL(
  `${protocol}://${env.VERCEL_PROJECT_PRODUCTION_URL || 'bellwoodslane.co.uk'}`,
);

const sitemap = async (): Promise<MetadataRoute.Sitemap> => [
  { url: new URL('/sell', base).href, lastModified: new Date() },
  { url: new URL('/probate', base).href, lastModified: new Date() },
  { url: new URL('/agents', base).href, lastModified: new Date() },
  { url: new URL('/save-the-sale', base).href, lastModified: new Date() },
  {
    url: new URL('/why-we-wont-buy-any-home', base).href,
    lastModified: new Date(),
  },
  {
    url: new URL('/instant-offer/methodology', base).href,
    lastModified: new Date(),
  },
  {
    url: new URL('/legal/fca-disclosure', base).href,
    lastModified: new Date(),
  },
  { url: new URL('/legal/privacy', base).href, lastModified: new Date() },
];

export default sitemap;
