import { env } from '@/env';
import type { MetadataRoute } from 'next';

const protocol = env.VERCEL_PROJECT_PRODUCTION_URL?.startsWith('https')
  ? 'https'
  : 'http';
const base = new URL(
  `${protocol}://${env.VERCEL_PROJECT_PRODUCTION_URL || 'bellwoodslane.co.uk'}`,
);

const sitemap = async (): Promise<MetadataRoute.Sitemap> => [
  { url: new URL('/instant-offer', base).href, lastModified: new Date() },
  {
    url: new URL('/instant-offer/methodology', base).href,
    lastModified: new Date(),
  },
  { url: new URL('/instant-offer/team', base).href, lastModified: new Date() },
  {
    url: new URL('/legal/fca-disclosure', base).href,
    lastModified: new Date(),
  },
];

export default sitemap;
