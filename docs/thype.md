# Thype — client notes

Thype is a travel magazine built on this CMS. This file records what was
changed for it, why, and what is still open. Read `CLAUDE.md` and
`docs/ARCHITECTURE.md` first; this only covers the differences.

Branch: `feature/thype`. Design source: two desktop mockups (`Home.png`,
`Blog Details.png`) and an asset export, received 2026-10-28. No Figma file.

---

## Hosting

**Current (from 2026-10-28):** Vercel, deployed from GitHub, with Neon
Postgres for content and Neon Object Storage for media. Everything about it —
resources, environment variables, first deploy, limits, troubleshooting — is
in [`DEPLOY-VERCEL-NEON.md`](DEPLOY-VERCEL-NEON.md). The Neon database is
described by the client as temporary.

The Docker/VPS route ([`XCLOUD_DOCKER.md`](XCLOUD_DOCKER.md)) still works but
is not being used for Thype now, and its image has not been built on this
branch.

| Mode | `CMS_DATABASE` | `CMS_STORAGE` | Use |
|---|---|---|---|
| Local only | `local` (default) | `local` (default) | Offline work, tests, the seed script |
| Local against Neon | `neon` | `s3` | Normal development once content lives in Neon |
| Vercel | `neon` | `s3` | Production |

## Tenancy

One repository branch, one deployment, one database per client — the model
the CMS already uses (`ARCHITECTURE.md` §9). Thype has its own Neon project
(database and bucket) and its own Vercel project; nothing is shared with other
clients, so there is no tenant column and no cross-client query to get wrong.

Changes that are generic CMS improvements (authors, archived status, post
fields, redirects on rename, rate limiting, tests) could be upstreamed to
`main` later. They are on this branch only for now.

---

## Content model

| Concept | How it is stored | Admin |
|---|---|---|
| Story | `posts` collection (existing), new fields below | Blog Posts |
| Author | **new** `authors` collection: public byline, bio, portrait, links | Authors |
| Category | A string on the post (existing rule: no taxonomy tables) | Blog Posts → filter |
| Tag | Strings on the post | Blog Posts → filter |
| Destination | `destinations` collection (existing), linked from posts by id | Destinations |
| Homepage | The CMS page with slug `/`, built from blocks | Pages → Home |
| Newsletter signup | **new** `subscribers` collection | Newsletter |

New post fields (all optional on read, so existing posts need no rewrite):
`featured`, `featuredImageAlt` (required with an image), `featuredImageCaption`,
`featuredImageCredit`, `authorProfileId`, `destinationIds`, `relatedPostIds`,
`showToc`.

New status: **archived** — off the public site, out of the trash. Applies to
every content type; public queries already treated anything but
published/scheduled as hidden.

How they relate: a **category** is the section a story is filed in (Europe,
Travel Guides); a **destination** is a place with its own guide page, and a
story can be about several; **tags** are loose cross-cutting labels. The
design's nav (Europe, America, Asia, Balkans) and the image tiles link to
category pages; that choice is editable, since both come from the CMS.

Public author data is separate from accounts. `cms.authors.getBySlug` returns
a projection without `userId`; account emails and roles never reach a page.

---

## Schema change and migration

Every SQL backend stores records as JSONB, so new post fields need no
migration. Two **new tables** are needed, created by the same idempotent
`create table if not exists` loop as every other collection, plus one index:

- `cms_authors`
- `cms_subscribers` (with a unique index on `data->>'email'`)

How to apply:

- **Neon (current):** already applied to the `thype` project on 2026-10-28.
  For a new branch or project, run `adapters/neon/schema.sql` in the Neon SQL
  editor, or `/admin/settings/connections` → create tables (dev only).
- **Docker / self-hosted Postgres:** nothing to do. `scripts/docker-start.mjs`
  runs `adapters/postgres/schema.sql` on every start.
- **Supabase:** run `adapters/supabase/schema.sql` in the SQL editor.
- **Local JSON:** nothing; files are created on first write.

Re-running any schema file is safe. **Rollback:** the change is additive.
Deploying the previous code ignores the new tables and fields. To remove them
entirely: `drop table cms_authors; drop table cms_subscribers;`. Do this only
after exporting subscribers (CSV under Newsletter), because it deletes the
signups. No existing data is altered by this branch.

---

## Public routes

| Path | What |
|---|---|
| `/` | Blocks of the Home page; minimal default until an editor builds it |
| `/blog/` | All stories (`?page=N` for the no-JS "Load more") |
| `/blog/[slug]/` | Story. Draft mode for Preview; follows recorded redirects |
| `/category/[slug]/`, `/tag/[slug]/` | Listings; 404 if no published story |
| `/destinations/`, `/destinations/[slug]/` | Destination index and guide pages |
| `/authors/[slug]/` | Author profile and stories |
| `/search/?q=` | Search; `noindex` and disallowed in robots.txt |
| `/contact/` | Contact form → Enquiries |
| anything else | CMS pages (About, Privacy, Terms…) via the catch-all |

The agency routes (`/tours`, `/activities`, `/faqs`) were removed from this
branch, and their modules switched off in `cms.config.ts`. The admin code is
untouched. URL layout lives in `config/site-paths.ts`.

Listing pages (category, tag, destinations, `/blog`) take their title, intro
and SEO from a CMS page at the same path when one exists — the existing
`cmsMetadata` pattern — so editors can write section introductions.

---

## Homepage blocks

Registered in `lib/cms/blocks.ts`, rendered by
`components/frontend/thype/blocks.tsx`:

- **Featured stories strip** — 1–4 photo tiles; featured posts, topped up
  with the latest.
- **Collection tiles** — up to 4 image + label + link tiles.
- **Category strip** — tinted band, centred heading, newest N in a category.
- **Story feed with sidebar** — lead + two-column grid + Load more.

No block stores a post id; stories are picked by rule when the page renders.
All blocks share one cached read of the published posts per request.

---

## CMS-managed chrome

- Menus by key: `main` (nav band), `utility` (top bar), `footer` (bottom bar).
- Header settings: promo banner (image, alt text, link) and the sidebar photo
  grid ("My last adventure").
- Footer settings: newsletter band on/off, heading and line.
- Site settings: logo, tagline, social links, WhatsApp number, copyright.

---

## Design decisions to review with the designer

Extrapolated or changed, because the mockups did not cover them or conflicted
with a requirement:

1. **Breakpoints.** Only 1920px desktop was supplied. Below 1024px the
   sidebar drops under the feed; below 640px cards stack, the nav becomes a
   Menu disclosure and the top-bar links are hidden (they repeat in the footer).
2. **Contrast.** Bronze `#ac7f52` is 3.6:1 on white, below WCAG AA for small
   text. Text and filled buttons use `#86603a` (5.6:1); the design bronze is
   kept for rules, dots and borders. Meta grey darkened from ~`#a8a8a4` to
   `#6b6c69`.
3. **Comment and like counts** on cards were removed (no comments system;
   decided 2026-10-28). Date and share remain.
4. **Ticker label.** The mockup says "TRAVEL TIPS"; the strip shows the
   latest story, so it is labelled "Latest" rather than hardcoding a section.
5. **Active nav on articles.** The mockup highlights the story's category in
   the nav; the nav highlights by URL, so on `/blog/...` nothing is active.
   Fixable by passing the category to the nav if wanted.
6. **Logo.** The export only contains a 295×37 raster logo. Until an SVG is
   uploaded in Site settings, the site name is set as a wordmark in the
   heading serif.
7. **Fonts** read from the pixels: Noto Serif 700, Noto Sans 400/500,
   Montserrat 600/700 (all SIL OFL, self-hosted by `next/font`). The pull
   quote in the mockup looks condensed; it uses Noto Sans italic.
8. **Image beside pull quote.** Editors get it by placing a quote straight
   after an image; it floats side by side on wide screens.
9. **Table of contents** is not in the mockup. It is shown only when a story
   has 3+ headings and the editor leaves it on.
10. **Additions not in the mockup:** reading time and tags/places on articles,
    category/tag/destination/author/search pages, 404, contact page, all in
    the same visual language.
11. Placeholder copy in the mockups ("News & magazine theme", "urname",
    2019 dates, lorem) is not used anywhere; those slots read from the CMS.

---

## Security notes

- Public writes: contact and newsletter only. Both have a honeypot and a
  per-IP rate limit (`lib/rate-limit.ts`, in-memory; exact for the single
  Docker container, approximate on Vercel where each function instance counts
  on its own).
- `/admin/setup` is open until the first admin exists. Create that account
  locally against Neon before the Vercel URL is public
  (`DEPLOY-VERCEL-NEON.md`, step 4).
- Storage secrets (`STORAGE_S3_SECRET_ACCESS_KEY`, `NEON_DATABASE_URL`) live
  in `.env.local` and Vercel only. Media URLs are public by design.
- Newsletter never reveals whether an address was already subscribed. The
  CSV export defuses spreadsheet formulas.
- JSON-LD is serialised with `<`, `>`, `&` escaped.
- "Load more" is a public, read-only Server Action returning card fields only.
- Author social links must be absolute http(s) URLs.

---

## Tests and checks

```bash
npm test         # node:test, no framework: logic + repositories (local adapter, temp dir)
npm run check    # typecheck + lint + route scan
npm run build
```

Local sample content: `npm run cms:seed:thype -- --images <folder of jpgs> --yes`
(local adapter only; merges, never replaces hand-made records).

Copy local content into Neon: `npm run cms:migrate -- --dry-run`, then
`-- --yes` (records + media files, URLs rewritten; see
`DEPLOY-VERCEL-NEON.md`, step 3). The seed's 29 records and 30 images are
already in Neon.

`tests/storage.test.ts` covers storage key safety and S3 URL encoding. The S3
adapter's network path was checked against the live Neon bucket (upload,
public read, signed read, delete) rather than mocked.

---

## Open items

- Real logo (SVG), confirmed font names and licence, brand colours if they
  differ from the sampled ones.
- Mobile and tablet frames, and hover/empty/error states, if the designer has them.
- Client copy: tagline, About, Affiliates disclosure, Privacy Policy, Terms
  (placeholders exist under Pages in local seed data only), contact details,
  social URLs, copyright line.
- Production domain for `NEXT_PUBLIC_SITE_URL`.
- Email provider for the newsletter (signups are held in the CMS meanwhile).
- Promo banner artwork and link, if the banner is to run.
- Whether category pages need richer intros than the CMS-page pattern gives
  (photo, description per category): that would need a categories store.
- Docker image build not run on this branch. Not needed while Thype is on
  Vercel; run `docker compose build` if it ever moves to the VPS.
- Videos and documents over 4 MB cannot be uploaded on Vercel until
  presigned browser uploads exist (`DEPLOY-VERCEL-NEON.md`, section 7).
- Decide how Preview deployments get data (`DEPLOY-VERCEL-NEON.md`,
  section 6) before a second developer starts pushing branches.
