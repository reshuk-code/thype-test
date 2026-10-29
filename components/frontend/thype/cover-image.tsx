import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * An editorial photo in a fixed-ratio box.
 *
 * Media-library images go through `next/image`, which serves resized
 * WebP/AVIF per `sizes`: site-relative ones (local storage) and those on the
 * bucket allow-listed in next.config.ts (`NEXT_PUBLIC_MEDIA_ORIGIN`). Any
 * other absolute URL — a photo an editor pasted from a CDN that is not in
 * `remotePatterns` — falls back to a plain lazy `<img>` rather than failing
 * the page. Either way the box holds its ratio before the image arrives, so
 * nothing shifts.
 */
const MEDIA_ORIGIN = process.env.NEXT_PUBLIC_MEDIA_ORIGIN ?? "";

function canOptimise(src: string): boolean {
  if (src.startsWith("/") && !src.startsWith("//")) return true;
  return MEDIA_ORIGIN !== "" && src.startsWith(`${MEDIA_ORIGIN}/`);
}

export function CoverImage({
  src,
  alt,
  sizes,
  ratio,
  priority = false,
  className,
  imageClassName,
}: {
  src: string | null | undefined;
  alt: string;
  /** The `sizes` attribute: how wide this renders at each breakpoint. */
  sizes: string;
  /** CSS aspect-ratio, e.g. "3 / 2". Omit when the parent sizes the box. */
  ratio?: string;
  /** For the one above-the-fold image per page. */
  priority?: boolean;
  className?: string;
  imageClassName?: string;
}) {
  return (
    <div
      className={cn("relative overflow-hidden bg-sage", className)}
      style={ratio ? { aspectRatio: ratio } : undefined}
    >
      {src ? (
        canOptimise(src) ? (
          <Image
            src={src}
            alt={alt}
            fill
            sizes={sizes}
            priority={priority}
            className={cn("object-cover", imageClassName)}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : undefined}
            decoding="async"
            className={cn("absolute inset-0 size-full object-cover", imageClassName)}
          />
        )
      ) : null}
    </div>
  );
}
