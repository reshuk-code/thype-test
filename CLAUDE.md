# Working in this repository

Rules for anyone changing this codebase — AI assistants especially, because you
will be asked to add a content module and there is exactly one right way to do
it here.

Read this file first. Read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) before
changing anything structural. If you are building a *client website* on top of
the CMS rather than changing the CMS, read
[`docs/BUILDING-A-SITE.md`](docs/BUILDING-A-SITE.md) instead.

---

## What this is

A reusable Next.js 16 CMS starter for travel companies. One repository per
client. The CMS is a library beside the app, not a framework around it:
`app/(frontend)/` is the client's website and belongs to the developer,
`app/admin/` is the CMS and rarely needs touching.

Stack: Next.js (App Router, React 19, Server Components and Server Actions),
TypeScript strict, Tailwind v4, Radix primitives, Zod v4, no ORM.

This branch (`feature/thype`) is the Thype travel magazine: read
[`docs/thype.md`](docs/thype.md) for what differs from the template. It is
hosted on Vercel with Neon Postgres and Neon Object Storage
(`CMS_DATABASE=neon`, `CMS_STORAGE=s3`); see
[`docs/DEPLOY-VERCEL-NEON.md`](docs/DEPLOY-VERCEL-NEON.md). Local work can
point at the same Neon project through `.env.local`, so a write in the admin
is a write to the real database.

---

## Before you finish any task

```bash
npm run check    # typecheck + lint + route scan. Must be clean. Not optional.
npm run build    # catches server/client boundary mistakes that check misses.
```

`check` ends with `cms:routes`, which lists any route under `app/` that is not
declared in `config/routes.ts`. It exits 0 either way — declaring a route is
optional — but read the output. An undeclared route is invisible in the admin
route inventory, so the client sees a URL nobody appears to own.

Then **verify the change in the running app**, not just in the type system. A
dev server usually runs on :3000. Most bugs in this codebase were found by
clicking the thing, not by reading it — including a form bug where React blanked
every field on a validation error and `tsc` was perfectly happy.

When you finish a roadmap item, tick it off in `docs/ROADMAP.md` and say what
you deliberately did *not* build.

---

## Hard rules

These are invariants. Breaking one is a bug even when the feature appears to
work.

1. **Every mutation starts with `requirePermission()`.** Hiding a button is not
   authorisation. Server Actions and route handlers are the boundary; the UI
   only decides what to render.
2. **Every input that crosses a trust boundary is parsed by a Zod schema from
   `schemas/`** before it reaches a repository. Never trust `formData`, never
   trust a query string, never trust an id in a URL.
3. **Business rules live in repositories** (`lib/cms/repositories/`), not in
   Server Actions and never in adapters. Slug uniqueness, publication windows,
   status transitions, derived fields: repository. Adapters stay dumb.
4. **Types in `types/` stay storage-agnostic.** Nothing there may know that
   Supabase or Mongo exists.
5. **Server-only code says so.** `lib/` modules that touch a database start with
   `import "server-only"`. Never import a repository into a Client Component.
6. **No secret ever crosses to the browser.** Only `NEXT_PUBLIC_*` reaches the
   client. The service-role key must never gain that prefix.
7. **Publishing is a separate permission from editing** (`*.publish` vs
   `*.update`). An Author saves drafts; they do not push them live.
8. **The admin never lies about what exists.** An unbuilt screen is
   `status: "planned"` in `config/admin-nav.ts` — greyed out with a "Soon" tag.
   A dead link is worse than a disabled one.
9. **Do not add dependencies** without saying why a dependency is better than
   twenty lines. This template ships no image decoder, no ORM, no form library,
   and that is a decision.
10. **Do not reformat files you did not otherwise change.** The repo is not
    Prettier-formatted; a formatting pass buries the real diff.

---

## Where things go

| Adding… | Goes in |
|---|---|
| A content type's fields | `types/content.ts` |
| Its validation | `schemas/<name>.ts` |
| Its business rules | `lib/cms/repositories/<name>.ts` |
| Its SDK entry | `lib/cms/index.ts` |
| Its admin screens | `app/admin/(dashboard)/<name>/` |
| Its editor form | `components/cms/<name>-form.tsx` |
| A shared field control | `components/cms/` (e.g. `image-field`, `gallery-field`) |
| A design-system primitive | `components/ui/` |
| A public-site component | `components/frontend/` |
| A new database backend | `adapters/<provider>/`, registered in `lib/database/index.ts` |

---

## Recipe: adding a content module

Follow the shape of `destinations` — it is the most complete example. In order:

1. **Type** — add or confirm the interface in `types/content.ts`. Content that
   is published extends `ContentRecord` (status, publishedAt, updatedBy).
2. **Schema** — `schemas/<name>.ts`: an input schema plus a
   `…WithRulesSchema` using `superRefine` for cross-field rules. Never accept
   `id`, `createdAt`, `updatedAt`, `updatedBy` from a form; the store and the
   session own those. Derived values (reading time) are computed in the
   repository, not submitted.
3. **Repository** — `lib/cms/repositories/<name>.ts`. Provide `list`, `get`,
   `getBySlug`, `getBySlugIncludingDrafts`, `getPublished`, `create`, `update`,
   `setStatus`, `trash`, `delete`, `duplicate`, plus any facet helpers. Reuse
   `buildListQuery`, `isPubliclyVisible`, `PUBLIC_STATUS_FILTER` and
   `resolvePublication` from `./base`.
4. **Register** in `lib/cms/index.ts`.
5. **Actions** — `app/admin/(dashboard)/<name>/actions.ts`: permission check,
   parse, publish check, repository call, `activity.record`, `revalidatePath`.
6. **Screens** — `page.tsx` (list), `new/page.tsx`, `[id]/page.tsx`,
   `row-actions.tsx`, and a filters component if the model has facets.
7. **Form** — `components/cms/<name>-form.tsx`. See the form rules below.
8. **Navigation** — remove `status: "planned"` from `config/admin-nav.ts`.
9. **Docs** — tick the roadmap; update the README table if it is client-facing.

Permissions and the collection name already exist for every planned model — see
`RESOURCES` in `lib/auth/permissions.ts` and `COLLECTIONS` in
`lib/database/adapter.ts`. Do not invent new ones without adding them there.

**A model that was never planned needs four more edits, and the recipe above
will not remind you.** Add it to `RESOURCES` and `CONTENT_RESOURCES`
(`lib/auth/permissions.ts`), `COLLECTIONS` (`lib/database/adapter.ts`),
`CMS_MODULES` *and* `DEFAULT_MODULES` (`lib/cms/define-config.ts`), and the
`collections` array in **both** `adapters/supabase/schema.sql` and
`adapters/neon/schema.sql` — twice in the Supabase file, since the second array
is what enables row level security. Miss the SQL and everything typechecks,
builds, and then fails at runtime with "Could not find the table". Adding the
rows is not enough on its own: the SQL has to be run against the project.

---

## Form rules

The three content editors are the fiddliest part of the codebase. Two rules,
both learned the hard way:

- **Submit through `onSubmit`, not `<form action={formAction}>`.** React resets
  a form whose `action` prop is a function as soon as the action completes,
  which destroys a rejected save: uncontrolled inputs fall back to their
  defaults, and controlled ones are blanked in the DOM without React noticing.
  Copy the `handleSubmit` in `components/cms/destination-form.tsx`.
- **Do not call `setState` synchronously inside an effect.** The lint rule that
  forbids it is on for a reason. Adjust state during render, or in the event
  handler that caused the change.

Repeating inputs share one `name` and are read with `formData.getAll()`.
Anything holding its own state — `ImageField`, `GalleryField`,
`RepeatableField` — takes its initial value as `defaultValue` and posts hidden
inputs.

---

## Slugs

Two kinds, and mixing them up ships broken URLs.

- **Pages own a path**: `slugSchema` → `/about`, leading slash, no trailing
  slash. The catch-all route serves them directly.
- **Everything else owns a name**: `bareSlugSchema` → `everest-base-camp`. A
  post or destination has no route of its own; the project mounts it at
  `app/blog/[slug]` or wherever it likes. Storing `/everest-base-camp` would
  bake a URL layout into the content.

---

## Adapter rules

Adapters translate; they do not decide. The query contract (`QuerySpec`) is
deliberately the lowest common denominator of Postgres, Mongo and Firestore.

Two operators behave differently per backend — `contains` means "array
includes" in the local engine and "substring" in SQL. If a filter's meaning has
to be exact, do it in the repository, as `posts.list` does for tags, and leave a
comment saying why.

---

## Comments

Comments explain **why**, never what. The bar: would a competent developer
reading this line in six months ask "why on earth is it done that way?" If yes,
answer that. If no, write nothing.

Do not narrate the code, do not leave `// TODO` without a phase tag
(`TODO(phase-3): …`), and do not delete an existing explanatory comment because
you rewrote the line beneath it.

---

## What not to do

- Do not build a drag-and-drop visual page builder. Explicitly out of scope.
- Do not add multi-tenancy. One repo per client; the seams are noted in the
  architecture doc.
- Do not create taxonomy tables for categories and tags. They are strings on
  the record, derived into facets by the repository.
- Do not "improve" the admin by making unbuilt screens reachable.
- Do not commit anything from `.cms-data/` or `public/uploads/` — real content
  and a working credential.
- Do not widen scope. If a task turns out to need a second module, say so and
  finish the first one properly.
