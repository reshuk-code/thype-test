# Deploying on Vercel with Neon

How Thype is hosted for now: **GitHub → Vercel** for the app, **Neon Postgres**
for content, **Neon Object Storage** for uploaded media. No Docker, no server
to look after. The Docker/VPS route in [`XCLOUD_DOCKER.md`](XCLOUD_DOCKER.md)
still works and is unaffected; this is an alternative, not a replacement.

Read this if you are deploying, changing an environment variable, moving
content into the hosted database, or wondering why an upload was refused.

---

## 1. How the pieces fit

```
 browser ──► Vercel (Next.js, functions in sin1 / Singapore)
                │
                ├── Neon Postgres  (ap-southeast-1)   records, settings, users
                │      via @neondatabase/serverless over HTTP
                │
                └── Neon Object Storage  (same branch)  uploaded files
                       bucket "media", public_read, S3 protocol

 browser ──► Neon Object Storage directly, for <img> src (public URLs)
 browser ──► Vercel /_next/image, which fetches from the bucket and resizes
```

| Concern | Where it lives | Code |
|---|---|---|
| Content, users, settings | Neon Postgres, tables `cms_*` (JSONB `data` column) | `adapters/neon/` |
| Media files | Neon bucket `media`, keys like `2026/10/28/111024/photo.jpg` | `lib/storage/providers/s3.ts` |
| Media metadata (alt text, folder) | `cms_media` table | `lib/cms/repositories/media.ts` |
| Which backend is active | Environment variables only | `lib/connections/resolve.ts` |

Backends are chosen **only** by environment variables (`CMS_DATABASE`,
`CMS_STORAGE`, `CMS_AUTH`). Nothing in the admin can re-point a live site.

### Why Singapore

`vercel.json` pins functions to `sin1`. Vercel's default is Washington
(`iad1`), and every database query would then cross the Pacific: a story page
makes several, so that is the difference between ~0.3 s and ~2 s. **If the
Neon project ever moves region, move `regions` in `vercel.json` with it.**

---

## 2. The current Thype resources

| Thing | Value |
|---|---|
| Neon project | `thype` (`fragrant-wildflower-99324524`), org of the Neon account that owns it |
| Region | `aws-ap-southeast-1` (Singapore). Object Storage is only offered in a few regions; this is one |
| Branch | `main` (`br-soft-pond-b3omsdfy`) |
| Database | `neondb`, role `neondb_owner`, pooled endpoint |
| Bucket | `media`, access level `public_read` |
| Storage credential | `thype-cms-media`, scopes `storage:read` + `storage:write` |

Secrets are **not** in this repository. They are in the gitignored
`.env.local` on the machine that set this up, and in Vercel's environment
variables. To get them again: Neon Console → project `thype` → **Connect**
(Postgres tab for the database URL, Storage tab for the S3 values), or rotate
the credential under **Settings → Credentials**.

This database is described as **temporary**: the plan may change to a paid
Neon plan or another backend. Nothing in the code depends on Neon
specifically; see section 9.

---

## 3. Environment variables

Set these in Vercel → Project → Settings → Environment Variables. The same
names go in `.env.local` for local work. `.env.example` documents every
variable the CMS understands.

| Variable | Value for Thype | Notes |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://<your-domain>` | No trailing slash. Canonical URLs, sitemap, Open Graph. Use the `*.vercel.app` URL until the real domain exists. |
| `CMS_SESSION_SECRET` | 64 hex chars | **Required.** Sign-in and every admin page refuse to run without it in production. Generate with `npm run cms:secret`. Use a different one from local. Changing it signs everyone out. |
| `CMS_DATABASE` | `neon` | |
| `CMS_STORAGE` | `s3` | |
| `CMS_AUTH` | `credentials` | Email + password against the `cms_users` table. |
| `NEON_DATABASE_URL` | `postgresql://…-pooler…/neondb?sslmode=require…` | From Neon → Connect. The pooled one is fine. |
| `STORAGE_S3_ENDPOINT` | `https://br-soft-pond-b3omsdfy.storage.c-4.ap-southeast-1.aws.neon.tech` | The branch's storage endpoint. |
| `STORAGE_S3_REGION` | `ap-southeast-1` | |
| `STORAGE_S3_BUCKET` | `media` | |
| `STORAGE_S3_ACCESS_KEY_ID` | `nak_live_…` | The credential's `token_id`. |
| `STORAGE_S3_SECRET_ACCESS_KEY` | `nsk_live_…` | The credential's `s3_secret_access_key`. **Never** prefix with `NEXT_PUBLIC_`. |
| `STORAGE_S3_PUBLIC_URL` | *(unset)* | Only if a CDN or custom domain is put in front of the bucket. |

Two of these are **read at build time**, so changing them needs a redeploy:
`NEXT_PUBLIC_SITE_URL`, and the `STORAGE_S3_*` values that decide which host
`next/image` may optimise (see `mediaBase()` in `next.config.ts`).

Nothing else is needed. `VERCEL` is set by Vercel itself and is what lowers
the upload limit (section 7).

---

## 4. First deployment, step by step

The Thype project has already done steps 1–4. They are here so the setup can
be repeated for a fresh environment or another client.

### Step 1 — Neon project, schema, bucket, credential

1. Create a Neon project in a region that offers Object Storage
   (`aws-us-east-1`, `aws-us-east-2`, `aws-eu-central-1`,
   `aws-ap-southeast-1` at the time of writing).
2. Apply the schema: paste `adapters/neon/schema.sql` into the Neon SQL
   Editor and run it. It is idempotent; running it again is safe. It creates
   one `cms_<collection>` table per collection plus `cms_kv`.
3. Object storage → **New bucket** → name `media`, access level
   **public_read**. Public because published HTML stores plain image URLs; a
   signed URL would expire inside a saved page.
4. Settings → Credentials → **Create credential** with `storage:read` and
   `storage:write`. Copy the secret immediately; it is shown once.

The Neon MCP server can do all four (`create_project`, `run_sql`,
`create_storage_bucket`, `create_credential`); that is how Thype's were made.

### Step 2 — `.env.local`

Copy `.env.example` to `.env.local` and fill in the table from section 3,
with `NEXT_PUBLIC_SITE_URL=http://localhost:3000`.

### Step 3 — Move local content in (optional)

If content was written against the local JSON store (`.cms-data/`,
`public/uploads/`), copy it across:

```bash
npm run cms:migrate -- --dry-run   # shows what would be copied
npm run cms:migrate -- --yes       # copies
```

It uploads every file that a record refers to as `/uploads/…` to the bucket
under the same key, rewrites those URLs to the bucket's public URLs, and
upserts every record by id. Re-running it is safe. It never modifies the
local copy.

It **skips** `users`, `subscribers`, `enquiries` and `activity_log` unless
named: `--with=users,subscribers`. Local accounts carry dev passwords, and
local signups are test data.

Thype's 29 sample records and 30 images were copied this way on 2026-10-28.

### Step 4 — Create the first admin *before* the site is public

`/admin/setup` creates the first administrator, and it is open to **anyone**
until one exists. On a freshly deployed public URL that is a race you do not
want to run. So create the account locally, against the hosted database:

```bash
npm run dev          # with .env.local pointing at Neon
# open http://localhost:3000/admin/setup and create the account
```

After that `/admin/setup` redirects to the login page for everyone, locally
and on Vercel, because the check reads the shared database.

### Step 5 — Vercel project

1. Vercel → **Add New → Project** → import the GitHub repository.
2. Framework preset: **Next.js** (detected). Build command, output directory
   and install command: leave the defaults.
3. Add the environment variables from section 3 for **Production**. See
   section 6 before ticking **Preview**.
4. **Production branch.** Vercel deploys the repository's default branch
   (`main`) to production. Thype's work is on `feature/thype`. Either merge
   it to `main`, or set Settings → Git → Production Branch to
   `feature/thype`.
5. Deploy. Then set `NEXT_PUBLIC_SITE_URL` to the URL Vercel gave you (or the
   real domain) and **redeploy**, because it is read at build time.

### Step 6 — Check the deployment

- `/` , `/blog/`, a story, `/destinations/`, `/search/?q=europe` render with
  images.
- An image's `src` is `/_next/image?url=https%3A%2F%2Fbr-…neon.tech…`, which
  means optimisation is on.
- `/admin` → sign in → Media → upload a small image → it appears, and its URL
  starts with the bucket endpoint.
- `/admin/settings/connections` shows Neon and S3-compatible as active.
- `/admin/setup` redirects to the login page.

---

## 5. Day-to-day

| Task | How |
|---|---|
| Deploy a change | Push to the production branch. Vercel builds and deploys. |
| Roll back | Vercel → Deployments → pick an older one → **Promote to Production**. Code only: the database is not rolled back. |
| Change an env var | Edit in Vercel, then **Redeploy**. Every variable needs a new deployment to take effect. |
| Look at the data | Neon Console → Tables, or the SQL Editor. Records are rows with a JSONB `data` column. |
| Restore data | Neon keeps history for the project's retention window (6 hours on this plan). Branch from a point in time, check it, then restore. Export the newsletter CSV before anything destructive. |
| Rotate the storage secret | Neon → Settings → Credentials → rotate. The access key id stays the same; update `STORAGE_S3_SECRET_ACCESS_KEY` in Vercel and `.env.local`, then redeploy. |
| Rotate the database password | Neon → Roles → reset password, then update `NEON_DATABASE_URL` everywhere. |

---

## 6. Preview deployments share the database, unless you stop them

Vercel builds a Preview deployment for every pushed branch and pull request.
If the Preview environment has the same variables as Production, **previews
read and write the live database and bucket**: a half-finished branch can
edit real content.

Pick one:

- **Simplest:** set the variables for Production only. Previews then have no
  backend (they fall back to the local store, which is empty and read-only
  on Vercel), so they are useful only for checking that a branch builds.
  Fine while one person deploys.
- **Better:** give previews their own Neon branch. Create a branch from `main`
  in Neon (it copies data and buckets copy-on-write), and set the Preview
  `NEON_DATABASE_URL` and `STORAGE_S3_ENDPOINT` to that branch's values. The
  same storage credential works, because credentials are valid on child
  branches of the branch they were made on.

---

## 7. Limits that are specific to this setup

**Uploads are capped at 4 MB on Vercel.** Vercel rejects any request body over
4.5 MB before the app sees it, and uploads go through a Server Action. When
`VERCEL` is set, `lib/storage/index.ts` lowers the storage limit to 4 MB, so
the upload zone refuses a large file up front with a clear message. Photos
are unaffected (the media library caps images at 1 MB anyway). Videos and
large PDFs over 4 MB need to be hosted elsewhere and embedded, until
presigned browser-to-bucket uploads are built (ROADMAP, Phase 4).

**Rate limiting is per instance.** The contact and newsletter limits in
`lib/rate-limit.ts` are in memory. On Vercel each warm function instance
counts separately, so the limit is approximate: an attacker spread across
instances gets a few more tries. The honeypots still catch simple bots.
`x-forwarded-for` is trustworthy on Vercel, which sets it itself. Move the
counter into the database if abuse shows up.

**Image optimisation has a quota.** Vercel's Hobby plan includes a monthly
allowance of image transformations. A magazine homepage uses many images. If
it runs out, either upgrade or put a CDN in front of the bucket and set
`STORAGE_S3_PUBLIC_URL`.

**Cold starts.** Neon suspends an idle compute after a few minutes on this
plan. The first request after that waits for it to resume (typically under a
second). Paid plans can disable suspension.

**Dev-only tools stay dev-only.** "Apply schema" and "Copy data" on
`/admin/settings/connections` refuse to run in production. Use the Neon SQL
Editor and `npm run cms:migrate` from a developer machine.

**The local data store does not work on Vercel.** The filesystem there is
read-only and per-instance. `CMS_DATABASE=local` or `CMS_STORAGE=local` in
Production will appear to work and lose everything. Always set both.

---

## 8. Troubleshooting

| Symptom | Likely cause |
|---|---|
| Admin or login errors with "CMS_SESSION_SECRET is required in production" | Not set for this environment (Production / Preview), or set after the last deploy. |
| Pages 500 with "Could not find the table" / relation does not exist | Schema not applied to this Neon branch. Run `adapters/neon/schema.sql`. |
| Upload fails: `S3 upload failed: 403 SignatureDoesNotMatch` | Wrong `STORAGE_S3_SECRET_ACCESS_KEY`, or it was rotated. |
| Upload fails: `403 InvalidAccessKeyId` | Wrong or revoked `STORAGE_S3_ACCESS_KEY_ID`. |
| Upload fails: `403 AccessDenied` | Credential lacks `storage:write`, or belongs to a different branch lineage. |
| Uploaded images 403 in the browser | The bucket is `private`. Change it to `public_read` in the Neon Console. The S3 API cannot change this. |
| Images render but are not optimised (plain `<img>`) | `CMS_STORAGE`/`STORAGE_S3_*` were not set at build time. Redeploy. |
| `Invalid src prop … hostname is not configured` | The bucket host changed but the app was not rebuilt. Redeploy. |
| "Storage accepts files up to 4 MB" | Expected on Vercel (section 7). |
| Login works locally but not on Vercel | Different `CMS_SESSION_SECRET` is fine. Check the user exists in the Neon `cms_users` table and is active. |
| Slow pages everywhere | `vercel.json` region does not match the Neon region. |

---

## 9. Moving off Neon later

Nothing above the adapters knows about Neon.

- **Another Postgres** (Supabase, a VPS): apply that adapter's `schema.sql`,
  then use the admin's Copy data tool in development, or a `pg_dump` of the
  `cms_*` tables. The table shape is the same across the SQL adapters.
- **Another S3 service** (R2, AWS): copy the bucket with any S3 tool
  (`aws s3 sync --endpoint-url …`), set the `STORAGE_S3_*` variables, then
  rewrite stored URLs from the old public base to the new one with an
  `update … set data = replace(data::text, old, new)::jsonb` per table. Or
  put a CDN domain in front of the bucket **now** (`STORAGE_S3_PUBLIC_URL`)
  so a later move never changes the URLs stored in content.
