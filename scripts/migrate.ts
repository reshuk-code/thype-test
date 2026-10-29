/**
 * Copies local content (.cms-data/ + public/uploads/) into the backend
 * selected in .env.local — for Thype, Neon Postgres + Neon Object Storage.
 *
 *   npm run cms:migrate -- --dry-run     # report only, writes nothing
 *   npm run cms:migrate -- --yes         # copy
 *   npm run cms:migrate -- --yes --with=users,subscribers
 *
 * What it does, in order:
 *   1. Finds every `/uploads/<key>` URL in every record and in site settings
 *      (featured images, galleries, rich text `src="…"`, settings images).
 *   2. Uploads each of those files to the target storage under the SAME key,
 *      so the rewrite is a prefix swap and keys stay human-readable.
 *   3. Upserts every record by id into the target database with those URLs
 *      rewritten, then copies the `site_settings` key/value entry.
 *
 * Safe to re-run: records are upserted by id and files are overwritten in
 * place. Nothing in the source is modified or deleted.
 *
 * Accounts and visitor submissions are skipped unless named in `--with`:
 * `users` carries password hashes from a dev machine, and `subscribers`,
 * `enquiries` and `activity_log` are test data that should not land in a
 * hosted database by accident. Create the first admin with /admin/setup
 * instead (see docs/DEPLOY-VERCEL-NEON.md).
 *
 * Runs on Node's own TypeScript support through the test loader, which maps
 * `@/` and stubs `server-only`; see the `cms:migrate` script in package.json.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";

import { resolveDatabase, resolveStorage } from "@/lib/connections/resolve";
import { COLLECTIONS, createDatabaseAdapter, type CollectionName } from "@/lib/database";
import { getStorage } from "@/lib/storage";
import type { BaseRecord } from "@/types/common";

const OPTIONAL: CollectionName[] = ["users", "subscribers", "enquiries", "activity_log"];
const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");

/*
 * A site-relative `/uploads/…` URL, or one written with a localhost origin.
 * The lookbehind stops it matching the tail of someone else's URL such as
 * `https://cdn.example.com/uploads/x.jpg`, which is not ours to move.
 */
const UPLOAD_URL =
  /(?:https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?|(?<![\w.:/-]))\/uploads\/([^\s"'<>()?#\\]+)/g;

const MIME: Record<string, string> = {
  avif: "image/avif",
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  pdf: "application/pdf",
};

function parseArgs(argv: string[]) {
  const withArg = argv.find((arg) => arg.startsWith("--with="))?.slice("--with=".length);
  const extra = (withArg ? withArg.split(",") : []).map((name) => name.trim()).filter(Boolean);

  const unknown = extra.filter((name) => !OPTIONAL.includes(name as CollectionName));
  if (unknown.length > 0) {
    throw new Error(`--with accepts ${OPTIONAL.join(", ")}; got ${unknown.join(", ")}.`);
  }

  return {
    dryRun: argv.includes("--dry-run"),
    yes: argv.includes("--yes"),
    include: new Set(extra as CollectionName[]),
  };
}

/** Every string inside a JSON-shaped value, depth first. */
function* strings(value: unknown): Generator<string> {
  if (typeof value === "string") yield value;
  else if (Array.isArray(value)) for (const item of value) yield* strings(item);
  else if (value && typeof value === "object") {
    for (const item of Object.values(value)) yield* strings(item);
  }
}

/** A deep copy with every string passed through `map`. */
function mapStrings<T>(value: T, map: (text: string) => string): T {
  if (typeof value === "string") return map(value) as T;
  if (Array.isArray(value)) return value.map((item) => mapStrings(item, map)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, mapStrings(item, map)]),
    ) as T;
  }
  return value;
}

async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`${question} [y/N] `);
  rl.close();
  return answer.trim().toLowerCase() === "y";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const target = resolveDatabase();
  const targetStorage = resolveStorage();

  if (target.id === "local") {
    throw new Error(
      "CMS_DATABASE is local, so there is nowhere to copy to. Set CMS_DATABASE " +
        "(e.g. neon) and its credentials in .env.local first.",
    );
  }
  if (targetStorage.id === "local") {
    throw new Error(
      "CMS_STORAGE is local, so uploaded files would stay on this machine. Set " +
        "CMS_STORAGE=s3 (or supabase) and its credentials in .env.local first.",
    );
  }

  const source = await createDatabaseAdapter("local", {});
  await source.init();

  const collections = COLLECTIONS.filter(
    (name) => !OPTIONAL.includes(name) || args.include.has(name),
  );

  // Read everything first, so the dry run and the real run report the same.
  const records = new Map<CollectionName, BaseRecord[]>();
  for (const name of collections) {
    records.set(name, await source.collection<BaseRecord>(name).findMany({}));
  }
  const settings = await source.kv.get<unknown>("site_settings");

  const keys = new Set<string>();
  const scan = (value: unknown) => {
    for (const text of strings(value)) {
      for (const match of text.matchAll(UPLOAD_URL)) keys.add(match[1]);
    }
  };
  for (const list of records.values()) list.forEach(scan);
  scan(settings);

  const missing = [...keys].filter(
    (key) => !existsSync(path.join(UPLOAD_ROOT, decodeURIComponent(key))),
  );

  console.log(`\nSource:  local (.cms-data/, public/uploads/)`);
  console.log(`Target:  database=${target.id}, storage=${targetStorage.id}\n`);
  for (const [name, list] of records) {
    if (list.length > 0) console.log(`  ${name.padEnd(14)} ${list.length} record(s)`);
  }
  console.log(`  ${"site_settings".padEnd(14)} ${settings === null ? "none" : "1 entry"}`);
  console.log(`  ${"files".padEnd(14)} ${keys.size - missing.length} to upload`);
  for (const key of missing) console.log(`  ! missing locally, URL left as is: /uploads/${key}`);

  const skipped = OPTIONAL.filter((name) => !args.include.has(name));
  if (skipped.length > 0) console.log(`\n  Skipped (add with --with=…): ${skipped.join(", ")}`);

  if (args.dryRun) {
    console.log("\nDry run: nothing written.");
    return;
  }
  if (!args.yes && !(await confirm("\nCopy into the target now?"))) {
    console.log("Cancelled.");
    return;
  }

  const storage = await getStorage();
  const urlFor = new Map<string, string>();

  for (const key of keys) {
    if (missing.includes(key)) continue;
    const decoded = decodeURIComponent(key);
    const extension = path.extname(decoded).slice(1).toLowerCase();
    const stored = await storage.upload({
      key: decoded,
      filename: path.basename(decoded),
      mimeType: MIME[extension] ?? "application/octet-stream",
      body: readFileSync(path.join(UPLOAD_ROOT, decoded)),
    });
    urlFor.set(key, stored.url);
    process.stdout.write(".");
  }
  if (urlFor.size > 0) console.log(` ${urlFor.size} file(s) uploaded`);

  const rewrite = (text: string) =>
    text.replace(UPLOAD_URL, (whole, key: string) => urlFor.get(key) ?? whole);

  const destination = await createDatabaseAdapter(target.id, target.credentials);
  await destination.init();

  let copied = 0;
  for (const [name, list] of records) {
    const store = destination.collection<BaseRecord>(name);
    for (const record of list) {
      const { id, createdAt: _created, updatedAt: _updated, ...rest } = mapStrings(record, rewrite);
      if (await store.findById(id)) await store.update(id, rest as Partial<BaseRecord>);
      else await store.create({ ...rest, id } as never);
      copied += 1;
    }
  }
  if (settings !== null) await destination.kv.set("site_settings", mapStrings(settings, rewrite));

  console.log(`Copied ${copied} record(s) to ${target.id}. The local copy is untouched.`);
}

main().catch((error: unknown) => {
  console.error(`\n${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
