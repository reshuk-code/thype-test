import "server-only";

import { createHash, createHmac } from "node:crypto";

import type { ProviderCredentials } from "@/types/connections";

import {
  resolveStorageKey,
  type StorageAdapter,
  type StoredFile,
  type UploadInput,
} from "../adapter";

/**
 * S3-compatible storage: Neon Object Storage, AWS S3, Cloudflare R2,
 * DigitalOcean Spaces, MinIO.
 *
 * Verified against Neon Object Storage (a `public_read` bucket). The other
 * services speak the same protocol, but have not been run against yet.
 *
 * **Why no AWS SDK.** The adapter needs three requests — PUT, GET and DELETE
 * of one object — and each needs a Signature Version 4 header. That is about
 * eighty lines on `node:crypto`. `@aws-sdk/client-s3` would add several
 * megabytes of dependency tree to a template that ships no image decoder
 * and no ORM on the same principle. If presigned browser uploads are added
 * later (see docs/ROADMAP.md), presigning is the same algorithm with the
 * signature moved into the query string, so the reasoning still holds.
 *
 * **Path-style addressing only** (`https://endpoint/bucket/key`). Neon
 * requires it, R2 and MinIO accept it, and AWS still serves it. Virtual-host
 * style would mean the bucket name in the hostname, which breaks TLS for
 * bucket names containing dots.
 *
 * **Public reads.** URLs returned to the CMS are plain public URLs, so the
 * bucket must allow anonymous reads (`public_read` on Neon, a public bucket
 * policy on AWS, a public r2.dev or custom domain on R2). Signed URLs for a
 * private bucket would expire inside published HTML, which this CMS stores
 * verbatim.
 */
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

interface S3Config {
  endpoint: URL;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBase: string;
}

function readConfig(credentials: ProviderCredentials): S3Config {
  const missing = (["bucket", "accessKeyId", "secretAccessKey"] as const).filter(
    (name) => !credentials[name]?.trim(),
  );
  if (missing.length > 0) {
    const names: Record<string, string> = {
      bucket: "STORAGE_S3_BUCKET",
      accessKeyId: "STORAGE_S3_ACCESS_KEY_ID",
      secretAccessKey: "STORAGE_S3_SECRET_ACCESS_KEY",
    };
    throw new Error(
      `S3 storage is selected but ${missing.map((name) => names[name]).join(", ")} ` +
        "is not set. See .env.example.",
    );
  }

  const region = credentials.region?.trim() || "us-east-1";
  const endpoint = new URL(
    credentials.endpoint?.trim() || `https://s3.${region}.amazonaws.com`,
  );
  const bucket = credentials.bucket.trim();

  return {
    endpoint,
    region,
    bucket,
    accessKeyId: credentials.accessKeyId.trim(),
    secretAccessKey: credentials.secretAccessKey.trim(),
    // A CDN or custom domain in front of the bucket goes here. Without one,
    // the bucket's own path-style URL is what Neon serves publicly.
    publicBase: (
      credentials.publicUrl?.trim() ||
      `${endpoint.origin}${endpoint.pathname.replace(/\/$/, "")}/${bucket}`
    ).replace(/\/$/, ""),
  };
}

/**
 * RFC 3986 encoding of each key segment, as SigV4 requires. Keys keep the
 * uploader's filename (see `buildStorageKey`), so parentheses, apostrophes
 * and non-ASCII letters really occur, and `encodeURIComponent` alone leaves
 * `!'()*` unescaped, which produces a signature mismatch.
 */
function encodeKey(key: string): string {
  return key
    .split("/")
    .map((segment) =>
      encodeURIComponent(segment).replace(
        /[!'()*]/g,
        (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
      ),
    )
    .join("/");
}

const sha256 = (data: string | Uint8Array) =>
  createHash("sha256").update(data).digest("hex");

const hmac = (key: string | Buffer, data: string) =>
  createHmac("sha256", key).update(data).digest();

/** Signature Version 4, header form. */
function signedRequest(
  config: S3Config,
  method: "GET" | "PUT" | "DELETE",
  key: string,
  body: Uint8Array | null,
  extraHeaders: Record<string, string> = {},
): { url: string; init: RequestInit } {
  const basePath = config.endpoint.pathname.replace(/\/$/, "");
  const path = `${basePath}/${encodeKey(config.bucket)}/${encodeKey(key)}`;

  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const day = amzDate.slice(0, 8);
  const payloadHash = sha256(body ?? "");

  const headers: Record<string, string> = {
    host: config.endpoint.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    ...Object.fromEntries(
      Object.entries(extraHeaders).map(([name, value]) => [name.toLowerCase(), value]),
    ),
  };

  const names = Object.keys(headers).sort();
  const signedHeaders = names.join(";");
  const canonicalHeaders = names
    .map((name) => `${name}:${headers[name].trim()}\n`)
    .join("");

  const canonicalRequest = [
    method,
    path,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const scope = `${day}/${config.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256(canonicalRequest),
  ].join("\n");

  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${config.secretAccessKey}`, day), config.region), "s3"),
    "aws4_request",
  );
  const signature = createHmac("sha256", signingKey)
    .update(stringToSign)
    .digest("hex");

  // `host` is set by fetch itself and is a forbidden header name in undici.
  const { host: _host, ...sent } = headers;

  return {
    url: `${config.endpoint.origin}${path}`,
    init: {
      method,
      headers: {
        ...sent,
        authorization:
          `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, ` +
          `SignedHeaders=${signedHeaders}, Signature=${signature}`,
      },
      body: body ? Buffer.from(body) : undefined,
      cache: "no-store",
    },
  };
}

/** The `<Code>` from an S3 XML error body, for a readable message. */
async function describeFailure(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  const code = /<Code>([^<]+)<\/Code>/.exec(text)?.[1];
  return code ? `${response.status} ${code}` : `HTTP ${response.status}`;
}

function toBytes(body: UploadInput["body"]): Uint8Array {
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
}

export function createS3StorageAdapter(
  credentials: ProviderCredentials,
): StorageAdapter {
  const config = readConfig(credentials);

  const publicUrl = (key: string) => `${config.publicBase}/${encodeKey(key)}`;

  return {
    provider: "s3",
    maxUploadBytes: MAX_UPLOAD_BYTES,

    async upload(input: UploadInput): Promise<StoredFile> {
      const key = resolveStorageKey(input);
      const body = toBytes(input.body);

      if (body.byteLength > MAX_UPLOAD_BYTES) {
        throw new Error(
          `File is larger than the ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB limit.`,
        );
      }

      const { url, init } = signedRequest(config, "PUT", key, body, {
        "content-type": input.mimeType || "application/octet-stream",
        // Keys are date-stamped and never rewritten in place, so a year of
        // browser and CDN caching is safe.
        "cache-control": "public, max-age=31536000, immutable",
      });
      const response = await fetch(url, init);

      if (!response.ok) {
        throw new Error(`S3 upload failed: ${await describeFailure(response)}`);
      }

      return {
        key,
        url: publicUrl(key),
        size: body.byteLength,
        mimeType: input.mimeType,
      };
    },

    async read(key: string): Promise<Uint8Array> {
      const { url, init } = signedRequest(config, "GET", key, null);
      const response = await fetch(url, init);
      if (!response.ok) {
        throw new Error(`Could not read stored media: ${await describeFailure(response)}`);
      }
      return new Uint8Array(await response.arrayBuffer());
    },

    async delete(key: string): Promise<boolean> {
      const { url, init } = signedRequest(config, "DELETE", key, null);
      const response = await fetch(url, init);
      // S3 answers 204 whether or not the object existed.
      return response.ok;
    },

    async getUrl(key: string): Promise<string> {
      return publicUrl(key);
    },
  };
}
