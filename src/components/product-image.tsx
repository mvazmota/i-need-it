"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
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
        <div className="flex flex-col items-center gap-2 text-muted/45">
          <ImageOff className="size-7" strokeWidth={1.4} />
          <span className="text-[10px] font-medium uppercase tracking-[0.16em]">
            No image
          </span>
        </div>
      )}
    </div>
  );
}
