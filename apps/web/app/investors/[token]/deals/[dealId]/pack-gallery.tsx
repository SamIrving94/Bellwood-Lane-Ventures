'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Cover image with a thumbnail strip and a full-screen lightbox (arrow keys,
 * Escape, swipe-free on purpose: tap the sides on a phone). Used for both
 * photos and renders; renders pass a caption so they are never mistaken for
 * the property as it stands.
 */
export function PackGallery({
  images,
  caption,
  variant = 'hero',
}: {
  images: string[];
  caption?: string;
  variant?: 'hero' | 'grid';
}) {
  const [open, setOpen] = useState<number | null>(null);
  const [active, setActive] = useState(0);

  const close = useCallback(() => setOpen(null), []);
  const step = useCallback(
    (d: number) =>
      setOpen((i) =>
        i === null ? i : (i + d + images.length) % images.length
      ),
    [images.length]
  );

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, close, step]);

  if (images.length === 0) return null;

  return (
    <>
      {variant === 'hero' ? (
        <div>
          <button
            type="button"
            onClick={() => setOpen(active)}
            className="group relative block w-full overflow-hidden rounded-[2px] bg-soft"
            aria-label="Open photo gallery"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={images[active]}
              alt=""
              className="aspect-[16/10] w-full object-cover transition-transform duration-700 group-hover:scale-[1.015] md:aspect-[16/8]"
            />
            <span className="absolute right-3 bottom-3 rounded-[2px] bg-forest/80 px-2.5 py-1 text-[12px] text-cream">
              {active + 1} / {images.length} · View all
            </span>
          </button>
          {images.length > 1 && (
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {images.map((u, i) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setActive(i)}
                  className={`shrink-0 overflow-hidden rounded-[2px] border-2 ${i === active ? 'border-forest' : 'border-transparent opacity-70 hover:opacity-100'}`}
                  aria-label={`Show photo ${i + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={u}
                    alt=""
                    className="h-14 w-20 object-cover md:h-16 md:w-24"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {images.map((u, i) => (
            <button
              key={u}
              type="button"
              onClick={() => setOpen(i)}
              className="relative overflow-hidden rounded-[2px] bg-soft"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={u}
                alt=""
                className="aspect-[4/3] w-full object-cover"
              />
              {caption && (
                <span className="absolute top-2 left-2 rounded-[2px] bg-cream/90 px-2 py-0.5 text-[10.5px] text-forest uppercase tracking-[0.14em] [font-family:var(--font-courier)]">
                  {caption}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {open !== null && (
        <dialog
          open
          className="fixed inset-0 z-50 m-0 flex h-full max-h-none w-full max-w-none flex-col border-0 bg-forest/95 p-0"
          aria-label="Photo gallery"
        >
          <div className="flex items-center justify-between px-4 py-3 text-[13px] text-cream">
            <span>
              {open + 1} / {images.length}
              {caption ? ` · ${caption}` : ''}
            </span>
            <button
              type="button"
              onClick={close}
              className="px-2 py-1 hover:underline"
            >
              Close
            </button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={images[open]}
              alt=""
              className="max-h-full max-w-full object-contain"
            />
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => step(-1)}
                  className="absolute inset-y-0 left-0 w-1/4 text-left text-3xl text-cream/70 hover:text-cream"
                  aria-label="Previous photo"
                >
                  <span className="pl-4">‹</span>
                </button>
                <button
                  type="button"
                  onClick={() => step(1)}
                  className="absolute inset-y-0 right-0 w-1/4 text-right text-3xl text-cream/70 hover:text-cream"
                  aria-label="Next photo"
                >
                  <span className="pr-4">›</span>
                </button>
              </>
            )}
          </div>
        </dialog>
      )}
    </>
  );
}
