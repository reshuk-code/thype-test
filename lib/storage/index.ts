import "server-only";

import { resolveStorage } from "@/lib/connections/resolve";
import type { ProviderCredentials, StorageProviderId } from "@/types/connections";

import type { StorageAdapter } from "./adapter";

/**
 * Storage adapter registry. Mirrors lib/database/index.ts.
 *
 * Storage is resolved independently of the database, so a project can keep
 * content in Neon and media in Supabase Storage if that suits it.
 *
 * Implemented: local, Supabase Storage, S3-compatible (Neon Object Storage,
 * AWS S3, R2).
 */
type Factory = (credentials: ProviderCredentials) => Promise<StorageAdapter>;

const factories: Record<StorageProviderId, Factory> = {
  local: async () => (await import("./providers/local")).createLocalStorageAdapter(),
  supabase: async (credentials) =>
    (await import("./providers/supabase")).createSupabaseStorageAdapter(credentials),
  s3: async (credentials) =>
    (await import("./providers/s3")).createS3StorageAdapter(credentials),
};

let instance: Promise<StorageAdapter> | null = null;

export function getStorage(): Promise<StorageAdapter> {
  instance ??= (async () => {
    const { id, credentials } = resolveStorage();
    const factory = factories[id];

    if (!factory) {
      throw new Error(
        `Unknown storage provider "${id}". Expected one of: ${Object.keys(factories).join(", ")}.`,
      );
    }

    return capForHost(await factory(credentials));
  })().catch((error: unknown) => {
    instance = null;
    throw error;
  });

  return instance;
}

/**
 * Vercel refuses any function request body over 4.5 MB, before Next.js sees
 * it and whatever `serverActions.bodySizeLimit` says. Uploads travel through
 * a Server Action, so on Vercel the real ceiling is the platform's, not the
 * adapter's. Lowering `maxUploadBytes` makes the upload zone reject a large
 * video with a clear message up front, instead of the browser receiving a
 * bare 413 halfway through. 4 MB leaves room for the multipart envelope.
 *
 * Lifting this needs presigned uploads straight from the browser to the
 * bucket (docs/ROADMAP.md, Phase 4).
 */
const VERCEL_BODY_LIMIT_BYTES = 4 * 1024 * 1024;

function capForHost(adapter: StorageAdapter): StorageAdapter {
  if (!process.env.VERCEL || adapter.maxUploadBytes <= VERCEL_BODY_LIMIT_BYTES) {
    return adapter;
  }
  // Object.create keeps the adapter's methods and their `this` intact.
  return Object.create(adapter, {
    maxUploadBytes: { value: VERCEL_BODY_LIMIT_BYTES, enumerable: true },
  }) as StorageAdapter;
}

export function resetStorage(): void {
  instance = null;
}

export * from "./adapter";
