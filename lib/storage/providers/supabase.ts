import "server-only";

import {
  createSupabaseAdminClient,
  readSupabaseConfig,
} from "@/adapters/supabase/client";
import type { ProviderCredentials } from "@/types/connections";

import {
  resolveStorageKey,
  type StorageAdapter,
  type StoredFile,
  type UploadInput,
} from "../adapter";

/**
 * Supabase Storage adapter.
 *
 * Assumes a public bucket (default name `media`). Create it in the Supabase
 * dashboard: Storage -> New bucket -> name `media` -> Public.
 *
 * TODO(phase-2): signed URLs for private buckets, and image transformations.
 */
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export function createSupabaseStorageAdapter(
  credentials: ProviderCredentials,
): StorageAdapter {
  const config = readSupabaseConfig(credentials);
  const client = createSupabaseAdminClient(config);
  const bucket = credentials.bucket?.trim() || "media";

  return {
    provider: "supabase",
    maxUploadBytes: MAX_UPLOAD_BYTES,

    async upload(input: UploadInput): Promise<StoredFile> {
      const key = resolveStorageKey(input);
      const body = Buffer.from(input.body as ArrayBuffer);

      if (body.byteLength > MAX_UPLOAD_BYTES) {
        throw new Error(
          `File is larger than the ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB limit.`,
        );
      }

      const { error } = await client.storage
        .from(bucket)
        .upload(key, body, { contentType: input.mimeType, upsert: false });

      if (error) {
        throw new Error(`Supabase Storage upload failed: ${error.message}`);
      }

      return {
        key,
        url: await this.getUrl(key),
        size: body.byteLength,
        mimeType: input.mimeType,
      };
    },

    async read(key: string): Promise<Uint8Array> {
      const { data, error } = await client.storage.from(bucket).download(key);
      if (error || !data) throw new Error("Could not read stored media.");
      return new Uint8Array(await data.arrayBuffer());
    },

    async delete(key: string): Promise<boolean> {
      const { error } = await client.storage.from(bucket).remove([key]);
      return !error;
    },

    async getUrl(key: string): Promise<string> {
      const { data } = client.storage.from(bucket).getPublicUrl(key);
      return data.publicUrl;
    },
  };
}
