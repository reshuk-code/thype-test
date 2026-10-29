import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveStorageKey } from "@/lib/storage/adapter";
import { createS3StorageAdapter } from "@/lib/storage/providers/s3";

describe("resolveStorageKey", () => {
  it("builds a dated key when no exact key is given", () => {
    const key = resolveStorageKey({ filename: "Ama Dablam.jpg" });
    assert.match(key, /^\d{4}\/\d{2}\/\d{2}\/\d{6}\/Ama-Dablam\.jpg$/);
  });

  it("keeps an exact key, as the migration needs", () => {
    assert.equal(
      resolveStorageKey({ filename: "x.jpg", key: "thype-seed/rectangle-21111.jpg" }),
      "thype-seed/rectangle-21111.jpg",
    );
  });

  it("refuses an exact key that could escape the bucket root", () => {
    for (const key of ["../etc/passwd", "a/../../b", "/abs.jpg", "a\\b.jpg", "a//b.jpg", ""]) {
      assert.throws(() => resolveStorageKey({ filename: "x", key }), /unsafe storage key/, key);
    }
  });
});

describe("S3 adapter configuration", () => {
  const base = {
    endpoint: "https://br-x.storage.c-4.ap-southeast-1.aws.neon.tech",
    region: "ap-southeast-1",
    bucket: "media",
    accessKeyId: "nak_live_test",
    secretAccessKey: "nsk_live_test",
  };

  it("serves public URLs path-style, with RFC 3986 key encoding", async () => {
    const storage = createS3StorageAdapter(base);
    assert.equal(
      await storage.getUrl("smoke/Café (1)'s!.jpg"),
      "https://br-x.storage.c-4.ap-southeast-1.aws.neon.tech/media/smoke/Caf%C3%A9%20%281%29%27s%21.jpg",
    );
  });

  it("prefers a configured public URL, such as a CDN", async () => {
    const storage = createS3StorageAdapter({ ...base, publicUrl: "https://cdn.example.com/" });
    assert.equal(await storage.getUrl("a/b.jpg"), "https://cdn.example.com/a/b.jpg");
  });

  it("names the missing variables when credentials are incomplete", () => {
    assert.throws(
      () => createS3StorageAdapter({ endpoint: base.endpoint }),
      /STORAGE_S3_BUCKET, STORAGE_S3_ACCESS_KEY_ID, STORAGE_S3_SECRET_ACCESS_KEY/,
    );
  });
});
