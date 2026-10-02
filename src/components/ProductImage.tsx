"use client";

import { useState } from "react";

/**
 * Store product thumbnail. A missing or failed image (e.g. a store's hotlink protection
 * rejecting it) falls back to a neutral placeholder instead of a broken-image icon.
 * Plain <img> on purpose: images are not proxied through our server or Vercel's
 * optimizer, so they load exactly as the store allows embedding them.
 */
export function ProductImage({ src, alt }: { src?: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label="No image available"
        className="flex size-16 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[10px] text-slate-400 dark:bg-slate-800"
      >
        No image
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- see component comment
    <img
      src={src}
      alt={alt}
      width={64}
      height={64}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="size-16 shrink-0 rounded-md bg-white object-contain"
    />
  );
}
