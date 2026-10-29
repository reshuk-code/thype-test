import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import {
  resolveStorageKey,
  type StorageAdapter,
  type StoredFile,
  type UploadInput,
} from "../adapter";

/**
 * Local filesystem storage: writes into `public/uploads/`. The /uploads route
 * serves files created after the production server starts.
 *
 * Suitable for development and for a site on a single long-lived server.
 * On serverless hosts each instance has its own ephemeral disk, so uploads
 * vanish — use the Supabase or S3 adapter there.
 */
const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");
const PUBLIC_PREFIX = "/uploads";

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export function createLocalStorageAdapter(): StorageAdapter {
  return {
    provider: "local",
    maxUploadBytes: MAX_UPLOAD_BYTES,

    async upload(input: UploadInput): Promise<StoredFile> {
      const key = resolveStorageKey(input);
      const target = path.join(UPLOAD_ROOT, key);

      // `key` is built from a sanitised stem, but resolve-and-check anyway so
      // a future change cannot turn this into a path traversal.
      const resolved = path.resolve(target);
      if (!resolved.startsWith(path.resolve(UPLOAD_ROOT))) {
        throw new Error("Refusing to write outside the uploads directory.");
      }

      const body = Buffer.from(input.body as ArrayBuffer);
      if (body.byteLength > MAX_UPLOAD_BYTES) {
        throw new Error(
          `File is larger than the ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB limit.`,
        );
      }

      await fs.mkdir(path.dirname(resolved), { recursive: true });
      await fs.writeFile(resolved, body);

      return {
        key,
        url: `${PUBLIC_PREFIX}/${key}`,
        size: body.byteLength,
        mimeType: input.mimeType,
      };
    },

    async read(key: string): Promise<Uint8Array> {
      const resolved = path.resolve(UPLOAD_ROOT, key);
      if (!resolved.startsWith(path.resolve(UPLOAD_ROOT) + path.sep)) throw new Error("Invalid storage key.");
      return fs.readFile(resolved);
    },

    async delete(key: string): Promise<boolean> {
      const resolved = path.resolve(path.join(UPLOAD_ROOT, key));
      if (!resolved.startsWith(path.resolve(UPLOAD_ROOT))) return false;

      try {
        await fs.unlink(resolved);
        return true;
      } catch {
        return false;
      }
    },

    async getUrl(key: string): Promise<string> {
      return `${PUBLIC_PREFIX}/${key}`;
    },
  };
}
