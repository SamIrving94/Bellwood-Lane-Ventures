/**
 * Which assistant a request came from, so the funnel can be measured per
 * channel: usage logs, the UTM tag on links to the site, and the source
 * saved with an in-chat enquiry.
 *
 * Read from the request's User-Agent only. Coarse on purpose: three values,
 * nothing about the person. Anything we don't recognise is 'other'.
 */

export type AssistantHost = 'chatgpt' | 'claude' | 'other';

export function hostFromUserAgent(
  userAgent: string | null | undefined
): AssistantHost {
  const ua = (userAgent ?? '').toLowerCase();
  if (ua.includes('openai') || ua.includes('chatgpt')) {
    return 'chatgpt';
  }
  if (ua.includes('claude') || ua.includes('anthropic')) {
    return 'claude';
  }
  return 'other';
}

/** From a tool callback's context: the SDK passes the original HTTP request as ctx.http.req. */
export function hostFromContext(ctx: unknown): AssistantHost {
  const req = (ctx as { http?: { req?: Request } } | undefined)?.http?.req;
  return hostFromUserAgent(req?.headers?.get('user-agent'));
}

export const HOST_LABELS: Record<AssistantHost, string> = {
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  other: 'an AI assistant',
};

/**
 * The utm_source for a link from this host. 'chatgpt' and 'claude' are
 * classed as "AI assistant" by the site's lead-source rules
 * (packages/analytics/lead-source.ts); 'mcp' is a tagged link.
 */
export const HOST_UTM_SOURCE: Record<AssistantHost, string> = {
  chatgpt: 'chatgpt',
  claude: 'claude',
  other: 'mcp',
};
