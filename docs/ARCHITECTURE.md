# Architecture

A reusable Next.js CMS for travel and tourism websites. The goal is a
WordPress-like experience for clients on top of a codebase that stays ordinary
Next.js for developers.

The whole design follows from one rule:

> **The CMS owns content. The developer owns presentation. Neither can force a
> change on the other.**

---

## 1. System architecture

```
   Your Next.js frontend            /admin (CMS interface)
   app/(frontend)/**                app/admin/**
            │                                │
            └──────────────┬─────────────────┘
                           ▼
                  CMS SDK   lib/cms  ->  cms.pages, cms.navigation, …
                           │
                  CMS core  repositories: business rules, validation, slugs,
                           │             publication windows, permissions
                           ▼
              Adapter interfaces   lib/database, lib/storage, lib/auth
                           │
        ┌──────────────┬───┴────────┬──────────────┐
        ▼              ▼            ▼              ▼
    local JSON     Supabase      MongoDB        Firebase
    (dev only)     (primary)   (unverified)  (not implemented)
```

Everything above the adapter line is storage-agnostic. Everything below is
storage-specific. Nothing crosses.

### Directory map

| Path | Contains |
|---|---|
| `app/(frontend)/` | The public website. Yours to replace entirely. |
| `app/admin/` | The CMS interface. |
| `app/api/` | Route handlers (preview mode today). |
| `components/ui/` | Design-system primitives (button, field, table, dialog). |
| `components/cms/` | Admin-only components (sidebar, page editor, menu editor). |
| `components/frontend/` | Public-site components (rich text, page renderer). |
| `lib/cms/` | The SDK and the repositories — CMS business logic. |
| `lib/database/` | `DatabaseAdapter` contract and the adapter registry. |
| `lib/storage/` | `StorageAdapter` contract and providers. |
| `lib/auth/` | `AuthAdapter` contract, sessions, passwords, permissions. |
| `lib/seo/` | Next.js Metadata API bridge. |
| `adapters/` | Concrete database adapters. |
| `schemas/` | Zod schemas — every trust boundary parses through these. |
| `types/` | Domain types, storage-agnostic. |
| `config/` | Per-project configuration: admin sidebar, declared routes. |
| `cms.config.ts` | The file you edit when starting a new client project. |
| `scripts/` | Developer tooling (`cms:routes`, `cms:reset`). |

---

## 2. CMS architecture

### The SDK

`lib/cms/index.ts` exports a single object:

```ts
import { cms } from "@/lib/cms";

const page = await cms.pages.getBySlug("/about");
const menu = await cms.navigation.get("main");
const site = await cms.settings.get();
```

It is server-only (enforced by the `server-only` package): every call reaches a
database with privileged credentials. Fetch in a Server Component, pass plain
data down to Client Components.

### Repositories

Each `cms.*` namespace is a repository in `lib/cms/repositories/`. Repositories
own the rules that are *not* storage-specific:

- slug normalisation and uniqueness
- publication windows (`published`, `scheduled`, `draft`, `trash`)
- parent/child integrity in the page tree
- duplication, trashing, restoring
- stripping credentials before a user record leaves the auth layer

They call adapters, never a driver. This is what makes changing the database a
configuration change rather than a rewrite.

### Validation

Every input that crosses a trust boundary is parsed with a Zod schema from
`schemas/` before it reaches a repository. Server actions do this first, then
call the repository, then translate any thrown `CmsError` into an `ActionState`
the form can render.

### Why the editors submit by hand

The content editors (`page-form`, `post-form`, `destination-form`) call their
action from an `onSubmit` handler rather than passing it to `<form action=…>`.

React resets a form whose `action` prop is a function as soon as that action
completes. On a validation failure that is destructive: uncontrolled inputs
fall back to their `defaultValue`, and controlled ones are blanked in the DOM
without React noticing — it sees no state change, so it never repaints them,
which can leave a `required` field empty and silently block the next submit.
Dispatching the same action ourselves skips the reset, so a rejected save
leaves the editor's work on screen.

The cost is that those three forms need JavaScript. They already did: the media
picker, gallery and repeatable rows are all client-side. Smaller forms
elsewhere in the admin still use the `action` prop, where losing two fields to
a rejected save is a much smaller loss than a half-written article.

---

## 3. Adapter architecture

### `DatabaseAdapter`

```ts
interface DatabaseAdapter {
  provider: string;
  init(): Promise<void>;
  collection<T>(name: CollectionName): CollectionStore<T>;
  kv: KeyValueStore;
  health(): Promise<AdapterHealth>;
}
```

Two decisions worth understanding:

**Generic collections, not one method per content type.** A new adapter is a
few hundred lines, and adding a content model needs no adapter change at all.

**A deliberately narrow query contract.** `QuerySpec` supports equality,
comparison, `in`, a substring `contains`, multi-field search, sorting and
offset pagination — the intersection of what Postgres, MongoDB and Firestore
all do natively. Anything richer is composed above the adapter. The brief warns
against assuming the three backends have identical capabilities; the answer is
to only ask them for what they all have.

### Adapter status

| Adapter | Status |
|---|---|
| **local** | Complete. JSON files under `.cms-data/`. **Development only** — no cross-process locking, and serverless filesystems are ephemeral. |
| **supabase** | **Verified against a live Supabase project**: schema applied, CRUD through the admin, public rendering. The intended production target. |
| **neon** | **Verified against a live Neon project**: schema applied, list/search/filter/sort, create, and public rendering. Run `adapters/neon/schema.sql`. |
| **mongodb** | Structurally complete, **unverified against a live cluster**. Needs `npm install mongodb`. |
| **firebase** | **Not implemented.** Every method throws with a clear message. The file documents what an implementer must handle (no case-insensitive contains, single-field inequality limits). |

Supabase and Neon share a table shape and the row mapping in
`adapters/supabase/mapping.ts`, which is what lets content be copied between
them unchanged. Copying Supabase → Neon and running the site off each in turn
is how both were verified.

**They do not share the column syntax.** PostgREST writes a jsonb key bare
(`data->>title`); SQL needs it quoted (`data->>'title'`). `columnFor()` serves
the first, `sqlColumnFor()` the second. Conflating them is a bug that hides
until something sorts or filters on a field inside `data` — every promoted
column keeps working, so it looks fine right up until it doesn't.

### The Supabase storage shape

```sql
id uuid, slug text, status text, created_at, updated_at, data jsonb
```

`slug` and `status` are promoted to real indexed columns because the CMS filters
on them constantly. Everything else lives in `data`, so content models gain
fields without a migration.

The cost: sorting or comparing a field inside `data` compares *text*, not
numbers. When numeric ordering matters (tour price, duration), promote that
field to a real column in `schema.sql` and add it to `columnFor()` in
`adapters/supabase/index.ts`.

RLS is enabled with no policies on every CMS table. The server uses the
service-role key and bypasses RLS; anon/authenticated browser clients get
nothing until you write explicit policies.

### `StorageAdapter`

Configured independently of the database. `local` writes to `public/uploads/`;
`supabase` uses a public bucket; `s3` speaks the S3 protocol to any
compatible service (verified on Neon Object Storage) with hand-rolled SigV4
signing and public-read buckets. On Vercel, `lib/storage/index.ts` lowers
`maxUploadBytes` to 4 MB to stay under the platform's request-body limit.

The media library sits on top of it: files go to the storage adapter, their
metadata to the database adapter, and `lib/cms/repositories/media.ts` is the
only place that knows the two must be kept in step. It uploads before it
records and deletes the record only after the file, so a failure leaves an
unreferenced file rather than a broken image on the live site.

### `AuthAdapter`

```ts
interface AuthAdapter {
  signInMode: "credentials" | "hosted";
  authenticate(credentials): Promise<CmsUser | null>;
  createSession(user): Promise<Session>;
  getSession(): Promise<Session | null>;
  destroySession(): Promise<void>;
}
```

Authorisation is deliberately *not* in this interface. **Roles and permissions
belong to the CMS**, so they survive swapping the identity provider: the
provider proves who you are, the CMS decides what you may do.

Two integration shapes, because providers genuinely differ:

| Shape | Verifies the password | Owns the session | Providers |
|---|---|---|---|
| `credentials` | The provider | The CMS (signed cookie) | Built-in, Supabase Auth, Neon Auth |
| `hosted` | The provider's own UI | The provider | Clerk |

`hosted` exists because Clerk has no server-side "check this password" call, so
sign-in must go through its own components. The login page reads `signInMode`
and either renders the built-in form or redirects to the provider's screen.

| Provider | Status |
|---|---|
| **credentials** | Complete. scrypt, no third-party account. |
| **supabase** | Implemented via `signInWithPassword`. **Unverified** against a live project. |
| **neon** | Implemented against the Stack Auth REST API with `fetch`, so no SDK dependency. **Unverified**. |
| **clerk** | Implemented, including provider and middleware wiring. **Unverified**. Requires env vars, because its middleware starts before CMS code runs. |

#### Linking an external identity to a CMS user

Every third-party provider funnels through `lib/auth/link.ts`:

1. Match on email, the one identifier all of them expose.
2. If **no CMS user exists at all**, the first person to sign in becomes super
   admin. Without this, a project starting on Clerk could never bootstrap.
3. Otherwise an unknown email is **refused, not auto-provisioned**. Otherwise a
   public Clerk sign-up page would be a public admin sign-up page.
4. A deactivated CMS user is refused whatever the provider says.

---

## 3a. Connections: configuring a backend

Everything — database, storage, sign-in — is configured in **`.env.local`**,
and nowhere else. There is no credential store and no way to change a backend
from inside the admin.

That is a deliberate simplification. An earlier design let an administrator
type credentials into `/admin` and switch backends there. It worked, but it
bought a credential store to encrypt, a key that could rotate out from under
it, a "does this survive a serverless deploy?" caveat on every screen, and a
real risk of someone re-pointing a live site by clicking around. None of that
buys anything a `.env.local` file does not already do better.

**Resolution:** `CMS_DATABASE` / `CMS_STORAGE` / `CMS_AUTH` choose the
provider; each provider's own variables supply its credentials. If the selector
is unset, the default in `cms.config.ts` applies.

```
CMS_DATABASE=neon
NEON_DATABASE_URL=postgresql://…
```

`/admin/settings/connections` is **read only**. It lists every provider the CMS
knows about and, for each, which environment variables are present:

- **Connected** — selected, and everything required is set
- **Missing details** — selected, but a required variable is absent (it names which)
- **Configured** — fully set up, but a different provider is selected
- **Not configured** / **Not built**

Nothing on that screen writes anything, so it is safe to look at on production.

### Setup tools are development-only

Applying a schema and copying data between backends run **only when
`NODE_ENV !== "production"`**. The server actions check and refuse; it is not
just a hidden panel. These are one-off tasks you do on your own machine while
wiring a project up — doing them against a live site is how production data
gets overwritten.

The intended flow is: prepare the backend locally, then deploy.

- **Create the CMS tables.** Neon can be done in one click, because its driver
  speaks SQL. Supabase's API cannot run DDL, so the screen shows the SQL to
  paste into that project's SQL editor and says why.
- **Copy content.** Reads every collection from the active backend and writes
  it to another, preserving ids so re-running is safe and references survive.
  It copies; it never deletes. Media files are not included — they live in the
  storage adapter, not the database.

Afterwards you switch over by editing `CMS_DATABASE`, like any other setting.

## 4. Route resolution

Three kinds of route coexist:

| Kind | Where it lives | Who renders it |
|---|---|---|
| **Developer route** | `app/about/page.tsx` | Your code |
| **CMS page** | A record with `slug: "/about"` | `app/(frontend)/[...slug]/page.tsx` |
| **System route** | `/admin`, `/api`, `/sitemap.xml` | The platform |

**Precedence needs no code.** Next.js matches static segments before a
catch-all, so a hand-written route always wins over a CMS page with the same
slug. That is exactly the behaviour the brief asks for.

### How the CMS knows about developer routes

Developers declare them in `config/routes.ts`:

```ts
export default defineRoutes([
  { path: "/tours", label: "Tour listing", cmsMetadata: true },
]);
```

No filesystem walking, no source parsing. Both are fragile and neither survives
bundling. Declaration is two lines, obvious to a WordPress developer, and
correct in production.

Drift is caught at development time by `npm run cms:routes`, which walks `app/`
and lists anything undeclared. It is a reminder, not a gate — declaring a route
is optional, and an undeclared route works perfectly.

Registering a route buys you two things:

1. It appears in the admin route inventory (`/admin/developer`), so a client
   asking "why can't I edit /tours?" gets an answer.
2. With `cmsMetadata: true`, editors manage its SEO from the CMS while you keep
   full control of the markup — see `app/(frontend)/page.tsx` for the pattern.

### Request flow for an unmatched path

```
/company
   ├─ a hand-written route?          -> Next.js renders it, done
   ├─ a published CMS page?          -> CmsPageRenderer
   ├─ a redirect rule?               -> 307 / 308
   └─ none of the above              -> 404
```

Redirects are checked *after* content, so a rule can never shadow a live page.
They are matched in the catch-all rather than in `proxy.ts`, because matching
needs a database and `proxy.ts` runs on every single request.

---

## 5. Authentication and authorisation

### Sessions

Stateless signed cookies. `base64url(payload).base64url(HMAC-SHA256)`, signed
with `CMS_SESSION_SECRET`, 7-day lifetime, `httpOnly` + `sameSite=lax` +
`secure` in production. Signing uses Web Crypto, so the same code runs in both
the Node and Edge runtimes.

Tradeoff: a stateless session cannot be revoked before it expires. Acceptable
for a small-team admin panel; server-side revocation is Phase 4. Deactivating a
user takes effect immediately anyway, because the layout re-reads the user
record on every request.

Passwords use `scrypt` from Node's standard library — a memory-hard KDF with no
native dependency to compile on Windows or a serverless host.

### The authorisation boundary

There are three layers, and only two of them are security:

| Layer | Purpose | Security boundary? |
|---|---|---|
| `proxy.ts` | Redirect cookie-less visitors to sign-in | **No.** It does not verify the cookie. |
| `app/admin/(dashboard)/layout.tsx` | Verify session, re-read user, resolve permissions | **Yes** |
| `requirePermission()` in every server action | Authorise the specific operation | **Yes** |

Hiding a button is never the boundary. Every mutating action calls
`requirePermission()` first, so a crafted request fails the same way a clicked
one would.

### Roles

`super_admin`, `admin`, `editor`, `author`, `viewer`. Permissions are
`<resource>.<action>` strings, so a new module needs no change to the auth core.
The matrix at `/admin/roles` is generated from the same table the server
enforces, so it cannot drift from reality.

Notable rules enforced server-side: only a super admin changes roles; nobody can
demote, deactivate or delete themselves; the last super admin cannot be removed.

---

## 6. Content models

All in `types/`, all storage-agnostic. Phase 1 implements pages, menus,
settings, redirects, users and the activity log. Phase 2 implements the rest —
the *types* for destinations, tours, itineraries, posts, testimonials, FAQs,
media and enquiries are already defined so the shape is settled before the
screens are built.

Every publicly addressable model embeds a `SeoMeta` object. Resolution order for
any field: the entity's own SEO value, then the entity itself (title, excerpt,
featured image), then site defaults. A site-wide `noindex` overrides everything
— the safe direction to fail in when a client site is not ready to launch.

### Blocks

A page body is `BlockInstance[]` — `{ id, type, props }`. `lib/cms/blocks.ts`
holds a registry mapping a block name to a Zod schema plus a `fields`
descriptor, so the admin can render an editor for a block it has never heard
of. `components/cms/block-editor.tsx` generates that form.

**The registry holds no React components.** It did in Phase 1, and that became
wrong the moment the block editor existed: the editor is a Client Component, so
a registry of components would pull every block's rendering — including the
grids that query the database — into the browser bundle. Rendering lives in
`components/frontend/blocks/index.tsx`, a plain name → component map used only
on the server.

The editor adds, reorders and removes blocks from a list. It is **not** a
drag-and-drop canvas, and that is a decision rather than an omission: up/down
buttons reorder reliably with a keyboard and on touch, and a builder that
competes with Elementor is what this project refuses to become.

The storage shape did not change when Phase 3 landed. A page whose body was a
single `rich-text` block in Phase 1 opens in the block editor as one Text
block, untouched.

Two ways a block fails soft, both deliberate: an unregistered type, and props
that fail their schema. Either way the renderer skips the block and leaves its
props on the record, so removing a block from the code cannot break a live page
and re-adding it brings the content back.

`components/frontend/rich-text.tsx` renders the editor's document into React
elements rather than HTML — no sanitiser, and no way for editor-authored
content to inject markup. That is why the editor stores a ProseMirror document
rather than the HTML a WYSIWYG would normally emit: HTML would have bought back
the parser, the sanitiser and the XSS class all at once.

Prose written before the rich editor landed is Markdown. `lib/rich-text.ts`
converts it into the same document on read, so the renderer has exactly one
path and no client's content had to be migrated.

Images can be dropped or pasted into the editor, so there are now two ways to
place a picture: the Image block for a standalone figure, and an inline image
inside prose. That is a deliberate exception to "one way to do it" — an
illustration belonging *within* a paragraph cannot be expressed as a sibling
block.

**An editor image is always uploaded, never embedded.** A pasted screenshot
arrives as a base64 data URI; inlining one would put megabytes into a database
row and break the size cap in `schemas/rich-text.ts`. Paste and drop upload
through the media library and store only the resulting URL, the Image
extension is configured with `allowBase64: false`, and `isSafeImageSrc`
refuses `data:` on render. An image pasted as a remote address is copied into
the library too, so a live page cannot break when someone else's site changes.

---

## 7. Frontend / CMS relationship

The frontend depends on the SDK. The CMS depends on nothing in the frontend.

```
app/(frontend)/**  ──imports──>  lib/cms
lib/cms            ──imports──>  nothing in app/
```

Consequences:

- Changing the database does not touch a frontend file.
- Deleting `app/(frontend)/` entirely leaves the CMS working.
- The CMS never dictates markup. `cms.navigation.get("main")` returns data;
  your component decides what a menu looks like.

Rendering strategy: public routes are static with a revalidation window, and
admin mutations call `revalidatePath("/", "layout")`, so edits appear
immediately without every visitor request hitting the database.

---

## 8. Extension points

| You want to… | Do this |
|---|---|
| Add a page/route | Write ordinary Next.js. Optionally declare it in `config/routes.ts`. |
| Query the CMS | `import { cms } from "@/lib/cms"` in a Server Component. |
| Use Supabase/Mongo directly | Do it. The CMS does not own your data access. |
| Add a block | `registerBlock({ name, label, schema, fields })`, then add it to `BLOCK_COMPONENTS`. |
| Change the admin sidebar | Edit `config/admin-nav.ts` (data, not markup). |
| Switch off a module | `modules: { blog: false }` in `cms.config.ts`. |
| Change the database | `database: "supabase"` in `cms.config.ts`, or `CMS_DATABASE` in the env. |
| Use a different identity provider | Implement `AuthAdapter`, return it from `getAuthAdapter()`. |
| Replace the CMS page renderer | Edit or delete `components/frontend/cms-page-renderer.tsx`. |
| Override a CMS page with code | Create the route. It automatically wins. |

---

## 9. Multi-project reuse

The template is per-project, not multi-tenant: each client gets their own repo,
database, storage and configuration, sharing only the architecture. Starting a
client site is: clone, `npm install`, edit `cms.config.ts`, `npm run dev`.

SaaS multi-tenancy is explicitly out of scope for the MVP. The seams that would
make it possible later — a per-request adapter instance and a tenant column in
the Supabase schema — are noted as TODOs where they would go.

---

## 10. Known limitations

Stated plainly, because a template that hides these wastes the next
developer's day:

1. The local adapter loads a whole collection into memory per query and has no
   cross-process locking. Development only.
2. Supabase `data->>field` comparisons are textual. Promote fields you need to
   sort numerically.
3. Stateless sessions cannot be revoked early.
4. There is no revision history — the activity log records *that* something
   changed, not the previous content.
5. No per-record ownership yet, so an author can edit any draft, not only
   their own.
6. Redirects are exact-match only. No wildcards or patterns.
7. Scheduled content goes live on the first request after its time passes
   (revalidation-driven), not on a cron tick.
8. The Supabase and Neon *auth* providers, and Clerk, are implemented but
   unverified against live accounts. The database adapters for Supabase and
   Neon are verified; their auth counterparts are not. Test with a throwaway
   project before putting a client on one.
9. Copying between backends moves database records and site settings, but not
   media files, which live in the storage adapter rather than the database.
10. Changing a backend needs an edit to `.env.local` and a restart. That is the
    intended trade: no runtime switching, no way to break a live site from the
    admin.
