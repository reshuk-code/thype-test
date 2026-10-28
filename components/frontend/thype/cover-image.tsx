import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * An editorial photo in a fixed-ratio box.
 *
 * Site-relative images (the media library) go through `next/image`, which
 * serves resized WebP/AVIF per `sizes`. An absolute URL — a photo an editor
 * pasted from a CDN the project has not allow-listed in `remotePatterns` —
 * falls back to a plain lazy `<img>` rather than failing the page. Either way
 * the box holds its ratio before the image arrives, so nothing shifts.
 */
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
        src.startsWith("/") && !src.startsWith("//") ? (
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
