import type { NextConfig } from "next";

/**
 * Where uploaded media is publicly served from when storage is S3-compatible
 * (Neon Object Storage for Thype): `STORAGE_S3_PUBLIC_URL`, or the bucket's
 * own path-style URL. Mirrors `publicBase` in lib/storage/providers/s3.ts.
 *
 * It is allow-listed for `next/image` and exposed to the browser as
 * `NEXT_PUBLIC_MEDIA_ORIGIN`, so `CoverImage` can serve resized WebP/AVIF for
 * library photos instead of the 1 MB original. Read at build time: changing
 * the bucket on Vercel needs a redeploy, like any NEXT_PUBLIC_ value.
 */
function mediaBase(): URL | null {
  if (process.env.CMS_STORAGE?.trim() !== "s3") return null;

  const endpoint = process.env.STORAGE_S3_ENDPOINT?.trim();
  const bucket = process.env.STORAGE_S3_BUCKET?.trim();
  const raw =
    process.env.STORAGE_S3_PUBLIC_URL?.trim() ||
    (endpoint && bucket ? `${endpoint.replace(/\/$/, "")}/${bucket}` : "");

  try {
    return raw ? new URL(raw.replace(/\/$/, "")) : null;
  } catch {
    return null;
  }
}

const media = mediaBase();

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_MEDIA_ORIGIN: media ? `${media.origin}${media.pathname}` : "",
  },
  images: {
    remotePatterns: media
      ? [
          {
            protocol: media.protocol === "http:" ? "http" : "https",
            hostname: media.hostname,
            port: media.port,
            pathname: `${media.pathname}/**`,
          },
        ]
      : [],
  },
  reactCompiler: true,
  trailingSlash: true,
  // One 50 MB video per request, with room for multipart headers.
  experimental: { serverActions: { bodySizeLimit: "52mb" } },

  // Pin the workspace root. Without this, Turbopack walks up and finds a
  // stray lockfile in the home directory and warns on every build.
  turbopack: {
    root: __dirname,
  },

  /**
   * Database drivers that are NOT dependencies of this template. Marking them
   * external means the bundler emits a plain require() instead of trying to
   * resolve them at build time, so a project that never selects the MongoDB
   * adapter does not need the driver installed. The adapter catches the
   * missing-module error and reports it with install instructions.
   */
  serverExternalPackages: ["mongodb", "firebase-admin"],
};

export default nextConfig;
