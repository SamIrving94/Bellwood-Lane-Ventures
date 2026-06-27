import { type NextRequest, NextResponse } from 'next/server';

/**
 * Image proxy for property thumbnails.
 *
 * Portal / CDN listing images (Rightmove, Zoopla, PropertyData CDNs) are
 * hotlink-protected: loaded directly from our origin they 403, so the browser
 * shows a broken image. We fetch them server-side — where the hotlink/referrer
 * checks don't bite — and stream the bytes back same-origin, so they just load.
 *
 * Usage: <img src={`/api/image-proxy?url=${encodeURIComponent(remoteUrl)}`} />
 *
 * Guards: https/http only, private/loopback hosts blocked (SSRF), 8s timeout,
 * 8MB cap, must resolve to an image content-type. Any failure → 404 so the
 * caller's onError fallback shows a clean placeholder.
 */

export const runtime = 'nodejs';

const MAX_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 8000;
const CACHE_HEADER = 'public, max-age=86400, s-maxage=604800, immutable';

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

/** Block loopback / private / link-local hosts to prevent SSRF. */
function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) {
    return true;
  }
  // IPv4 private / loopback / link-local ranges.
  if (
    /^127\./.test(h) ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^169\.254\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h)
  ) {
    return true;
  }
  // IPv6 loopback / unique-local / link-local.
  if (
    h === '::1' ||
    h.startsWith('fc') ||
    h.startsWith('fd') ||
    h.startsWith('fe80')
  ) {
    return true;
  }
  return false;
}

export async function GET(request: NextRequest): Promise<Response> {
  const raw = request.nextUrl.searchParams.get('url');
  if (!raw) return new NextResponse('missing url', { status: 400 });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new NextResponse('bad url', { status: 400 });
  }

  if (
    (target.protocol !== 'https:' && target.protocol !== 'http:') ||
    isBlockedHost(target.hostname)
  ) {
    return new NextResponse('forbidden', { status: 403 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const upstream = await fetch(target.toString(), {
      signal: controller.signal,
      headers: {
        // Look like a browser coming from the image's own origin — defeats
        // the referrer/hotlink checks that 403 a bare cross-origin load.
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        Referer: `${target.protocol}//${target.host}/`,
        Accept: 'image/avif,image/webp,image/*,*/*;q=0.8',
      },
    });

    if (!upstream.ok || !upstream.body) {
      return new NextResponse('not found', { status: 404 });
    }
    const type = (upstream.headers.get('content-type') ?? '')
      .split(';')[0]
      ?.trim()
      .toLowerCase();
    if (!type || !ALLOWED_TYPES.has(type)) {
      return new NextResponse('not an image', { status: 404 });
    }
    const len = Number(upstream.headers.get('content-length') ?? '0');
    if (len && len > MAX_BYTES) {
      return new NextResponse('too large', { status: 404 });
    }

    const buf = await upstream.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) {
      return new NextResponse('too large', { status: 404 });
    }

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': type,
        'Cache-Control': CACHE_HEADER,
      },
    });
  } catch {
    return new NextResponse('fetch failed', { status: 404 });
  } finally {
    clearTimeout(timer);
  }
}
