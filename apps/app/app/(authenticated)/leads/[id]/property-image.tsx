'use client';

import { useState } from 'react';

/**
 * Property hero image with a graceful fallback. Portal/CDN listing images are
 * frequently hotlink-protected (they 403 when loaded from our origin) or the
 * URL is empty — either way a bare <img> renders a broken-image icon. This
 * swaps to the placeholder on error so the page never shows a broken image.
 */
export function PropertyImage({
  src,
  alt,
}: {
  src: string | null;
  alt: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="flex h-64 items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400 md:h-full">
        <span className="text-sm">No image available</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/image-proxy?url=${encodeURIComponent(src)}`}
      alt={alt}
      className="h-64 w-full object-cover md:h-full"
      onError={() => setFailed(true)}
    />
  );
}
