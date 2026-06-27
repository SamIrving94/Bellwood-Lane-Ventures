'use client';

import { useState } from 'react';

/**
 * Property thumbnail that actually loads. Portal/CDN images are
 * hotlink-protected (403 cross-origin), so we route them through our
 * /api/image-proxy. If they still fail — or there's no URL — we show a clean
 * placeholder instead of a broken-image icon.
 */
export function PropertyThumb({
  src,
  alt,
  className,
}: {
  src: string | null;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-[10px] text-slate-400 ${className ?? ''}`}
      >
        No photo
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/image-proxy?url=${encodeURIComponent(src)}`}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}
