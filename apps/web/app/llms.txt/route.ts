import { buildLlmsTxt } from '@/lib/llms-txt';
import { database } from '@repo/database';

export const revalidate = 300;

const TRAILING_SLASH = /\/$/;

/**
 * /llms.txt: plain-text map for AI assistants. Guides come from the
 * database, so a published guide appears inside the revalidate window, the
 * same as the sitemap. The MCP address is only listed when it is set, so we
 * never point an assistant at a server that is not live.
 */
export async function GET() {
  const guides = await database.guidePost
    .findMany({
      where: { status: 'published' },
      select: { slug: true, title: true, metaDescription: true },
      orderBy: { publishedAt: 'desc' },
    })
    .catch(() => []);

  const pluginBase = process.env.PLUGIN_PUBLIC_URL?.replace(TRAILING_SLASH, '');
  const body = buildLlmsTxt(
    guides,
    pluginBase ? `${pluginBase}/mcp` : undefined
  );
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
    },
  });
}
