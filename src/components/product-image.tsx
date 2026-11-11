"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

export function ProductImage({
  src,
  alt,
  className,
  imageClassName,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  imageClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  const initial = alt.trim().charAt(0).toUpperCase() || "?";

  return (
    <div
      className={cn(
        "product-canvas relative flex items-center justify-center overflow-hidden",
        className,
      )}
    >
      {src && !failed ? (
        // Shop images come from arbitrary hosts, so no next/image optimisation here.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className={cn("h-full w-full object-contain", imageClassName)}
        />
      ) : (
        <div className="flex flex-col items-center gap-2.5 text-muted/55">
          <span className="flex size-12 items-center justify-center rounded-full border border-line/80 bg-surface/55 font-display text-[24px] leading-none text-ink/25 sm:size-14 sm:text-[28px]">
            {initial}
          </span>
          <span className="text-[9px] font-medium uppercase tracking-[0.18em]">
            No image
          </span>
        </div>
      )}
    </div>
  );
}
