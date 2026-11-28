/**
 * Domain check for OpenAI's plugin submission: OpenAI gives a token and
 * fetches it back from this path to confirm we control the domain.
 *
 * The token lives in OPENAI_APPS_CHALLENGE (set it in the kept-plugin
 * Vercel project when the submission form shows it). Without it the path
 * is a plain 404. Confirm the exact path in the form when submitting: it
 * comes from search results, not OpenAI's own docs (docs/mcp/10-funnel.md).
 */

export const dynamic = 'force-dynamic';

export function GET(): Response {
  const token = process.env.OPENAI_APPS_CHALLENGE?.trim();
  if (!token) {
    return new Response('Not found', { status: 404 });
  }
  return new Response(token, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
