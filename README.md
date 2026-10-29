# Aviva CMS

A reusable Next.js CMS for travel agencies, trekking companies, tour operators
and hotels. Clients manage content at `/admin`; developers build the website
with ordinary Next.js. One copy of this repository per client, hosted on the
client's own VPS with Docker: the database, the uploads and the code never
depend on an outside service.

**The CMS is a library sitting beside your app, not a framework replacing it.**
Nothing in `app/(frontend)/` is generated, wrapped or owned by the CMS. You
write React, you fetch data with one import, you render it however you like.

Current version: **0.1.4** (see `package.json`).

---

## Contents

- [Quick start](#quick-start)
- [The five-minute tour](#the-five-minute-tour)
- [What you get](#what-you-get)
- [Starting a client project](#starting-a-client-project)
- [Hosting on a VPS with Docker](#hosting-on-a-vps-with-docker)
- [Other hosting](#other-hosting)
- [Commands](#commands)
- [Documentation](#documentation)
- [Status](#status)

---

## Quick start

Requires **Node.js 22** and npm.

```bash
npm install
npm run dev
```

Open **http://localhost:3000/admin** and create the first administrator.

No database and no credentials are needed to start: the default `local` adapter
stores JSON under `.cms-data/`. `npm run cms:seed` fills it with a complete demo
site if you want something to look at. Switching to a real backend is a few
environment variables and no frontend file changes.

---

## The five-minute tour

```ts
import { cms } from "@/lib/cms";

const page   = await cms.pages.getBySlug("/about");
const posts  = await cms.posts.getPublished({ perPage: 10 });
const places = await cms.destinations.getFeatured(6);
const trips  = await cms.tours.getFeatured(6);
const menu   = await cms.navigation.get("main");
const site   = await cms.settings.get();
```

Call these in a Server Component. That is the entire public API surface a
frontend developer needs; everything else — adapters, sessions, permissions,
validation — is behind it.

```
app/(frontend)/          Your website. Replace it entirely.
app/admin/               The CMS. You will rarely open this.
cms.config.ts            The file you edit when starting a client project.
config/routes.ts         Routes you hand-built, declared for the admin.
.env.local               Which database, storage and auth provider to use.
```

---

## What you get

**For the client's content team**, at `/admin` — a replacement for the
WordPress dashboard they are used to:

| Screen | What it does |
|---|---|
| Pages | Create, edit, duplicate, schedule, preview, trash. Nested pages. |
| Blog | Posts with an author byline, one category, free tags, reading time. |
| Destinations | Places with coordinates, best season, highlights and a gallery. |
| Tour packages | Price, length, difficulty, inclusions, FAQs and a day-by-day itinerary. |
| Activities | What travellers do, tagged onto tour packages. |
| Testimonials | Quotes with a rating and attribution. No page of their own. |
| FAQs | Questions and answers, grouped by category. |
| Enquiries | The inbox behind the contact and booking forms, with triage and internal notes. |
| Media | Upload with drag and drop, folders, alt text, search, picker. |
| Navigation | Menus with nesting, resolved to hrefs for the frontend. |
| SEO | Per-entity and site-wide, with a search-result preview and an audit of pages missing metadata. |
| Redirects | Exact-match, applied before a 404. |
| Header & Footer | Announcement bar, header CTA, footer columns, social and small print. |
| Site Settings | Identity, contact, social, analytics, maintenance mode. |
| Users & Roles | CRUD, role assignment, password reset, a read-only permission matrix. |
| Database & Connections | What backend is in use, and what the environment actually provided. |
| Developer | An inventory of every route, and who owns it. |

Editors save drafts; publishing is a separate permission. Screens that are not
built yet — bookings and customers — appear greyed out with a "Soon" tag rather
than as links that 404. See [`docs/ROADMAP.md`](docs/ROADMAP.md).

**For the developer:** a typed SDK, swappable database adapters, three storage
providers, four authentication providers, server-enforced permissions, and no
opinion whatsoever about how your pages look.

---

## Starting a client project

This repository is the **template**. Each client gets their own copy, which
keeps a link back here so CMS fixes can be pulled in later.

```bash
git clone https://github.com/reshuk-code/Aviva-CMS-with-Docker.git client-name
cd client-name
git remote rename origin template
git remote add origin <the client project's own repository>
npm install
```

Then:

1. Edit `cms.config.ts` — site name, backend, and which modules the client
   needs. Unused modules disappear from the sidebar and their routes 404.
2. Copy `.env.example` to `.env.local` and fill in what you actually use.
3. Build the frontend in `app/(frontend)/`. Replace the placeholder home page.
4. Declare your routes in `config/routes.ts` so the admin can show who owns
   what. `npm run cms:routes` lists the ones you have missed.

To bring a later CMS fix from the template into a client project:

```bash
git fetch template
git merge template/main
```

Keep client-specific work in `app/(frontend)/`, `components/frontend/` and
`cms.config.ts` and these merges stay painless. Adding a new content type to
the CMS itself follows a fixed recipe in [`CLAUDE.md`](CLAUDE.md).

### Connecting a backend

Everything is configured through environment variables — there is nothing to
type into the admin. Add the variables, restart, and
`/admin/settings/connections` reports what it detected.

```bash
CMS_DATABASE=postgres        # local | postgres | supabase | neon | mongodb | firebase
CMS_STORAGE=local            # local | supabase | s3
CMS_AUTH=credentials         # credentials | supabase | neon | clerk
```

The Docker setup below uses `postgres` + `local` + `credentials`, so everything
stays on the VPS. The other adapters exist for projects that want a hosted
service; their verification status is recorded honestly in
[`docs/ROADMAP.md`](docs/ROADMAP.md).

Whichever authentication provider you choose, **roles stay in this CMS**. The
provider proves who someone is; the CMS decides what they may do. Add each
person under `/admin/users` with the email they sign in with, or they are
refused.

---

## Hosting on a VPS with Docker

The standard setup: the app, PostgreSQL and a private database viewer run in
Docker on one VPS (xCloud or any other). Nothing goes through GitHub, Docker
Hub or cloud storage.

```
/var/www/your-site/
├── .env                  secrets and settings — keep a copy somewhere safe
├── docker-compose.yml    written by the deploy
├── uploads/              every file the editors upload, browsable on disk
└── backups/              a database dump from before each deploy (last 10)
```

**Releasing a change** — from your computer, with Docker Desktop running:

```bash
npm version 0.1.5 --no-git-tag-version   # the version becomes the image tag
npm run deploy
```

That builds the image locally, sends it to the VPS over SSH, checks the site's
ports are free, backs up the database, switches the site over and waits until it
answers. Each site on the same VPS needs its own `APP_PORT` and `ADMINER_PORT`
in its server `.env`; the deploy refuses a port that is already taken and
suggests a free one.

If a release goes wrong, the previous three images are still on the server:

```bash
npm run deploy -- --rollback 0.1.4
```

**Seeing the database** — Adminer listens only on the VPS itself. Open a tunnel,
then browse to <http://localhost:8081>:

```bash
ssh -L 8081:127.0.0.1:8081 user@your-vps
```

**Seeing uploads** — they are ordinary files in `uploads/`. The public URL
`/uploads/2026/09/18/062454/photo.jpg` is `uploads/2026/09/18/062454/photo.jpg`
on disk.

First-time setup (SSH key, `.env.deploy`, the server's `.env`, Docker access for
the SSH user) and backup advice are in
[`docs/XCLOUD_DOCKER.md`](docs/XCLOUD_DOCKER.md).

### What the company must hold

So that a site never depends on one developer's personal accounts:

- the VPS and hosting panel login (xCloud), and the domain;
- a copy of each site's code, and of its server `.env`;
- off-server copies of `backups/` and `uploads/`.

The deploy itself needs only SSH access to the VPS.

---

## Other hosting

Any host that runs Next.js works. On serverless platforms (Vercel included) note
two things:

- `CMS_SESSION_SECRET` is **required** in production. The app refuses to boot
  without it, rather than silently signing sessions with a key that changes on
  every deploy.
- `CMS_STORAGE=local` writes to the filesystem, which is ephemeral there.
  Uploads will vanish. Use `supabase` or `s3`.

The full Vercel + Neon (Postgres and Object Storage) walkthrough, including
moving local content across with `npm run cms:migrate`, is
[`docs/DEPLOY-VERCEL-NEON.md`](docs/DEPLOY-VERCEL-NEON.md).

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server. |
| `npm run build` | Production build. |
| `npm run check` | Typecheck, lint and route scan. Run this before every commit. |
| `npm run deploy` | Build the Docker image and ship it to the VPS. `-- --rollback <version>` to go back. |
| `npm run cms:routes` | Lists routes in `app/` missing from `config/routes.ts`. |
| `npm run cms:secret` | Generates a value for `CMS_SESSION_SECRET`. |
| `npm run cms:seed` | Fills the local adapter with a demo site. Asks first. |
| `npm run cms:reset` | Wipes `.cms-data/`. Local adapter only. Irreversible. |
| `npm run cms:migrate` | Copies local records and `public/uploads/` files into the backend set in `.env.local`, rewriting media URLs. `-- --dry-run` first. |
| `npm test` | Unit tests (`node:test`, no framework). |
| `node scripts/test-docker.mjs` | Smoke-tests a built image in a throwaway Docker stack. |

---

## Documentation

| Document | Read it when |
|---|---|
| [`docs/BUILDING-A-SITE.md`](docs/BUILDING-A-SITE.md) | You are building a client website on top of this. Start here. |
| [`docs/XCLOUD_DOCKER.md`](docs/XCLOUD_DOCKER.md) | You are putting a site on a VPS, deploying an update, or restoring a backup. |
| [`docs/DEPLOY-VERCEL-NEON.md`](docs/DEPLOY-VERCEL-NEON.md) | You are deploying on Vercel with Neon Postgres and Neon Object Storage (how Thype is hosted). |
| [`docs/thype.md`](docs/thype.md) | You are working on the Thype magazine: what changed from the template, design decisions, open items. |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | You are changing the CMS itself, or need to know why something is the way it is. |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | You need to know what is built, what is not, and what was left out deliberately. |
| [`CLAUDE.md`](CLAUDE.md) | You are an AI assistant working in this repository — or a developer who wants the rules in one page. |

---

## Status

Phase 1 (foundation, pages, SEO, navigation, settings, users) is complete, and
so is Phase 2's content half: the media library, blog, destinations, tour
packages, activities, testimonials, FAQs and enquiries. What remains in Phase 2
is entity links in the menu editor.

`npm test` runs the unit tests in `tests/` (blog logic, repositories against a
temporary local store, storage keys); `scripts/test-docker.mjs` covers the
Docker image end to end.

---

Built by Aviva Web Technologies.
