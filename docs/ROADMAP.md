# Roadmap

Status as of the Phase 1 delivery. Anything not marked **Done** is not built —
the admin shows unbuilt screens greyed out rather than as links that 404.

---

## Phase 1 — Foundation · **Done**

| Item | Status | Notes |
|---|---|---|
| Project architecture | Done | `docs/ARCHITECTURE.md` |
| CMS configuration | Done | `cms.config.ts`, module switches, env overrides |
| Database adapter interface | Done | `lib/database/adapter.ts` |
| Local JSON adapter | Done | Zero-config development. Not for production. |
| Supabase adapter | Done | **Verified** against a live Supabase project |
| Authentication foundation | Done | `AuthAdapter`, scrypt, signed-cookie sessions |
| Roles & permissions | Done | Server-enforced; read-only matrix at `/admin/roles` |
| Admin layout | Done | Configurable sidebar, light/dark, responsive |
| First-run setup | Done | `/admin/setup` creates the first super admin |
| Pages | Done | Create, edit, duplicate, trash, delete, schedule, preview |
| Dynamic CMS routing | Done | `app/(frontend)/[...slug]` |
| Developer route registry | Done | `config/routes.ts`, `/admin/developer`, `npm run cms:routes` |
| SEO | Done | Per-entity + site defaults, Metadata API bridge, audit list |
| Sitemap & robots | Done | Generated from CMS content and declared routes |
| Redirects | Done | Exact-match, applied before 404 |
| Navigation | Done | Menus with nesting, resolved to hrefs for the frontend |
| Site settings | Done | Identity, contact, social, analytics, maintenance |
| Users | Done | CRUD, role assignment, password reset, self-service change |
| Database status | Done | `/admin/database` |
| Activity log | Done | Feeds the dashboard |
| **Connections screen** | Done | `/admin/settings/connections`: read-only status of what `.env.local` provides |
| Neon adapter | Done | **Verified** against a live Neon project |
| Supabase / Neon / Clerk auth | Done | Unverified against live accounts |
| Setup tools | Done | Apply schema, copy data between backends. Development only. |

**Not in Phase 1, by design:** the media library, the tourism content models,
and any block editor beyond a single rich-text block.

---

## Phase 2 — Content

The tourism-specific half. Types are already defined in `types/content.ts`;
these items are the repositories, admin screens and SDK namespaces.

- [x] **Media library** — upload (multi-file, drag and drop), flat folders, alt
      text, caption, search and type filters, copy-URL, delete.
      `/admin/media`, `cms.media`, verified against Supabase Storage.
- [x] **Media picker** wired into the featured-image and OG-image fields via
      `components/cms/image-field.tsx`. Fields still store a plain URL, so a
      CDN address typed by hand stays valid.
- [x] **Blog** — posts with drafts, scheduling, trash and duplication;
      author byline; one category and free tags per post, filterable in the
      list. `/admin/blog`, `cms.posts`. Slugs are bare, not paths: the project
      mounts posts at whatever route it wants.
- [x] **Destinations** — name, place, coordinates, best season, highlights,
      gallery, featured flag and display order, with the same draft/schedule/
      trash lifecycle as pages. `/admin/destinations`, `cms.destinations`.
- [x] **Tour packages** — pricing with a compare-at price, duration,
      difficulty, group size, altitude, best season, highlights, inclusions and
      exclusions, FAQs, gallery, and a destination reference.
      `/admin/tours`, `cms.tours`.
- [x] **Itinerary editor** — day by day, reorderable, with accommodation,
      meals, altitude, walking time and per-day photographs. Days are
      renumbered 1..n on save, and the schema rejects an itinerary whose length
      contradicts the headline duration.
- [x] **Activities** — name, slug, description, icon token, featured image and
      display order, with the same draft/schedule/trash lifecycle as pages.
      `/admin/activities`, `cms.activities`. The tour editor now has a real
      activity picker.
- [x] **Testimonials** — quote, 1-5 rating, attribution (name, role, company,
      country), optional photograph and tour reference, featured flag.
      `/admin/testimonials`, `cms.testimonials`.
- [x] **FAQs** — question, answer, free-text category and order, grouped for
      rendering by `cms.faqs.getGrouped()`. `/admin/faqs`, `cms.faqs`.
- [x] **Enquiries** — inbox for the contact/booking form. Triage states,
      internal notes, resolved subject. `/admin/enquiries`, `cms.enquiries`.
- [x] **Regions** — the area a trip happens in, one level above a destination:
      name, slug, description, country, elevation range, highlights, best
      season, gallery, featured flag and display order, with the same
      draft/schedule/trash lifecycle as everything else. `/admin/regions`,
      `cms.regions`.

      **A content type, not a taxonomy.** A region sells — it earns a page with
      photographs and prose, which a string on a destination cannot carry. That
      is the exception to the rule about categories and tags a few lines below,
      and it is the reason for it.

      **`Destination.region` is deliberately untouched.** It stays free text.
      Making it a reference would have rewritten a field that eight display
      sites already read, and stranded every destination whose current text
      matches no record. The two can be reconciled later if a client asks.

      Regions needed new entries in `COLLECTIONS`, `CMS_MODULES` and the
      permission `RESOURCES` — it was not one of the pre-planned models.

      **Not built:** no coordinates (a region is an area; a pin at its notional
      centre is wrong more often than useful), no public `/regions` route yet —
      the SDK namespace is there, the project mounts it where it likes.

- [x] **Admin theming is local** — `components/cms/theme.tsx` replaced
      `next-themes`, which is no longer a dependency.

      It rendered its anti-flash `<script>` from inside a Client Component, and
      React 19 warns about that on every client render. The library exposes no
      way to skip it: `nonce` and `scriptProps` only set attributes on a script
      it renders regardless. Here the script is emitted by `app/admin/layout.tsx`
      — a Server Component — so it lands in the HTML and still runs before the
      first paint, and the client half is state only.

      `useTheme()` keeps the same `{ theme, resolvedTheme, setTheme }` shape, so
      the header toggle and the toaster were one-line import changes. Outside
      the provider it reports light rather than throwing, because the public
      site has no theme system by design.

      **The stored preference is read in a lazy `useState` initialiser, not an
      effect** — setState-in-an-effect is forbidden here, and it is unnecessary:
      the script has already set the class, so this state never decides what is
      on screen during the first render.

- [ ] Entity links in the menu editor (`target: "entity"`, stubbed today).

**Testimonials and FAQs carry no slug and no SEO block**, unlike every other
published type. Neither is a page: both are rendered inside somebody else's
page, and giving them URLs would produce thin duplicate content.

**An enquiry is a record, not content.** It extends `BaseRecord`, never
publishes, and has no public read — `cms.enquiries` must not be surfaced from
a page. `create()` accepts only the traveller's own fields, so a crafted form
post cannot file itself as "converted" or write the operator's notes; the
admin triages an enquiry but never edits what was sent.

**Activity ids on a tour survive an activity being hidden.** Ids the picker
cannot show — the activity is in the trash, or the module is switched off for
that client — are posted back as hidden inputs, so saving a tour does not
silently strip tags. Deleting an activity still leaves a dangling id by
design; nothing rewrites tours, and the delete dialog says so.

- [x] **Header and footer settings** — `/admin/settings/header` and
      `/admin/settings/footer`, the last two "Soon" items under Website.
      Header: an announcement bar (text, optional link and link label), a
      sticky toggle, a phone/email toggle and one call-to-action button.
      Footer: a blurb, link columns, social and contact toggles, a copyright
      line and a legal note. Both live on the settings singleton in the
      adapter's key/value area, so neither needed a collection, a permission or
      a line of SQL — `settings.read` / `settings.update` already covered them.

      **A footer column names a menu; it does not carry links.** Columns store
      `{ heading, menuKey }` and the layout resolves each through
      `cms.navigation.get()`, so a URL is edited in one place and every menu
      that points at it follows. The alternative — links typed into the footer
      screen — is how a footer ends up pointing at a page that moved two months
      ago. The cost is that a client must build a menu before they can build a
      column, which the screen says, with a link to Navigation.

      **The hard-coded template links are still the fallback**, for the footer
      exactly as they already were for the header: configure no columns, or
      configure columns whose menus resolve to nothing, and the built-in links
      render. A fresh install has a navigable footer before anyone opens the
      admin.

      **The announcement bar is not inside the sticky header.** The notice
      scrolls away and the navigation stays, which is what a client means by
      "keep the header visible". Both halves of the bar and of the CTA are
      validated together in `superRefine` — a label with no URL and a URL with
      no label are both rejected rather than left for the frontend to guess at.

      **Not built:** a second header layout, per-page header or footer
      overrides, a newsletter signup, and payment or certification badge rows.

- [x] **Enquiries arrive with context.** "Enquire about this trip" and the
      destination page's "Enquire" now link to `/contact?tour=…` or
      `?destination=…`. The contact page restates what the visitor clicked
      through from, preselects the trip, and writes an opening line into the
      message box; the enquiry files with `subjectType`/`subjectId` already
      set, so the inbox shows "Tour: Everest Base Camp Trek" instead of a
      stranger asking about an unnamed trek.

      **The query string is parsed like any other untrusted input**
      (`enquiryPrefillSchema`). A value that is not slug-shaped is rejected
      before any lookup and the page falls back to the plain form, which is the
      honest answer to a mangled link.

      **A chosen trip beats the destination the visitor arrived from.** Both
      would be true; only one is what they asked about. The trip select is
      deliberately unnamed and the subject is posted as a hidden pair, so the
      form can never file two subjects.

**Categories and tags are strings on the post, not their own collections.**
A travel blog has a dozen categories that change twice a year; two more tables
and two more admin screens would cost more than they return. `cms.posts`
derives the facet lists from the posts themselves. Revisit if a client ever
needs per-category descriptions or SEO.

**Not done in the media library, deliberately:** image dimensions (needs a
decoder; the CMS ships no native dependency), nested folders, replacing a file
in place, and knowing which pages reference a file — fields store URLs, not
media ids, so that check would be a guess. The last one is the reason the
delete dialog says what it says.

---

## Phase 3 — Editing experience

- [x] **Block editor** — add, reorder and remove blocks on a page.
      `components/cms/block-editor.tsx`. A list with up/down buttons, not a
      drag-and-drop canvas; the form for each block is generated from its
      registered `fields`, so a project's own block gets an editor for free.
- [x] **Built-in blocks** — text, hero, image, gallery, CTA, destination grid,
      trip grid, activity grid, blog grid, testimonials, FAQ, contact form.
      The grids read published content through the SDK at render time.
- [x] **Block registration docs** — docs/BUILDING-A-SITE.md, "Step 6 — Blocks".
- [x] **Rich text editor** — a WordPress-style toolbar on posts, destinations,
      tours and the Text block: a Paragraph/Heading style menu, bold, italic,
      underline, strike, clear-formatting, lists, quote, code, divider, link
      (Ctrl+K) and unlink, undo/redo, and a full-screen toggle. Placeholder
      text, a live word count, and a sticky toolbar for long posts.
      `components/cms/rich-text-field.tsx`, built on TipTap.

      **The word count is derived from the document, not from TipTap's
      CharacterCount.** It has to agree with the "3 min read" the blog
      publishes, and that number comes from `richDocToPlainText` in the posts
      repository. Two counters that can disagree is worse than one.

      **An empty field stores a document holding one empty paragraph**, not a
      document with no nodes. ProseMirror renders an empty document as nothing
      at all, so there is no paragraph for the placeholder to decorate and no
      caret target. `toEditableRichDoc` is the editor-side shape;
      `RichText` treats a lone empty paragraph as no content, so the frontend
      does not gain a stray blank paragraph.

      **It stores a ProseMirror document, not HTML.** The renderer walks that
      document into React elements, so the CMS still ships no HTML parser and
      no sanitiser and editor-authored content still cannot inject markup —
      the property `components/frontend/rich-text.tsx` had from the start.
      Storing HTML would have been the obvious WordPress imitation and would
      have cost a sanitiser dependency plus a standing XSS surface.

      **Legacy Markdown is read, not migrated.** `lib/rich-text.ts` converts
      the old syntax into the same document on load, so existing content opens
      formatted and nothing rewrites a client's prose behind their back.

- [x] **Images in the editor** — drag a file in, paste a screenshot, pick from
      the media library, or paste an image address. Every route uploads through
      `media.upload()` and inserts the stored URL; alt text is edited inline
      while the image is selected.

      **Nothing is ever embedded as base64.** A pasted screenshot arrives as a
      data URI, and inlining one would put megabytes in a database row and
      break the content size cap. `allowBase64: false` on the extension,
      `isSafeImageSrc` on render, and an upload on paste are three independent
      places that enforce it.

      **Remote addresses are copied, not hotlinked**, so a published page
      cannot break when someone else's site moves the file. Fetching an
      editor-supplied URL is an SSRF risk, so the host is resolved and refused
      if it points anywhere internal — see the note in `media/actions.ts` about
      the DNS rebinding race that check does not close.

      **The editor accepts images only**, unlike the media library, which
      deliberately takes documents, audio and video too.

      **Deliberately not built:** tables, a source/HTML view, per-field toolbar
      configuration, and image captions, sizing or alignment — the Image block
      still owns a full-width figure with a caption.

- [x] **A tab per content section** on the tour, destination, region and
      activity editors, in the client's order: Facts, Pricing, Overview,
      Highlights, Info, Itinerary, Include, Images, FAQs. One section per tab,
      and the tab strip is the only place its name appears — the heading under
      it was the same word twice. The tab list lives at the top of each form;
      the machinery is `components/cms/form-sections.tsx`.

      **SEO is not one of the tabs.** It is about how the page is found rather
      than what is on it, and it reads as a different argument; it keeps its own
      card below the panel, with a shortcut in the right rail
      (`components/cms/seo-jump-card.tsx`) because it is otherwise off the
      bottom of a long form.

      **A hidden tab is hidden, never unmounted**, for the same reason a
      collapsed section is: these forms post with `new FormData(form)`, which
      reads only what is in the DOM.

      **Deliberately not built:** per-user tab memory, a URL fragment per tab,
      and lazy mounting of a tab's fields.

- [x] **Four featured-image shapes plus the gallery** on all four content
      types — normal, horizontal, vertical and a 1920x700 banner —
      in one Images tab. `components/cms/featured-images-field.tsx`, with the
      fallback ladders in `lib/images.ts`. A record that has a vertical image
      renders as a portrait card in listings and one that has not keeps the
      landscape tile, so a grid mixes the two per record.

      **Deliberately not built:** cropping, resizing or any image processing.
      The template still ships no image decoder; a crop is an editorial
      decision and the four slots are how the client makes it. The banner
      dimensions are a hint in the UI, not a validated constraint.

- [x] **"In use" on the Images tab** — every photograph and video the record
      references, collected from the form as it stands: featured slots,
      gallery, itinerary days and anything dropped into a rich text editor.
      Read-only and draggable into any slot; it deliberately does not append to
      the gallery, which is an editorial sequence. `lib/used-media.ts`.

      **The scan is structure-blind** — it parses the form's values and keeps
      what looks like a media address, rather than knowing where each field
      hides its images. A structure-aware version rots the first time a field
      is added. It is manual and on mount, not live: it is far too much work to
      redo on every keystroke.

- [x] **Every record's header says when it was published**, not only when it
      was last saved — the two are rarely the same date, and "last updated an
      hour ago" never answered "is this live?". A scheduled record reads
      "Publishes …" rather than "Published …". `lib/record-meta.ts`.

- [x] **Admin lists show twenty rows and grow by twenty** — "Load next 20"
      rather than page numbers. The window size is `perPage` in the URL, so a
      list stays shareable and works without JavaScript, and page navigation
      takes back over at `MAX_PER_PAGE` so a long collection stays reachable.
      `components/ui/pagination.tsx`.

- [x] **One typeface, Mulish, at a 16px base**, by client instruction —
      `--font-mono` points at it too, so the slug field and the JSON-LD box are
      proportional. That is the accepted trade, not an oversight.

- [x] **Highlights, inclusions and exclusions are one rich text editor each**,
      not a row-per-item list, so the writer chooses bulleted, numbered or no
      list at all. Records written before this hold a `string[]`; both shapes
      are read by `toRichListContent()` and nothing is rewritten until the
      record is next saved. `types/rich-text.ts`, `RichListContent`.

      **Deliberately not migrated.** Rewriting a client's live prose in place
      is a worse risk than reading two shapes.

- [x] **Collapsible sections and the Fast menu** on the tour and destination
      editors: every section starts closed and folds from its header, and the
      Fast menu in the right rail scrolls to one — or, expanded, to a single
      field inside it. The menu itself can be hidden.
      `components/cms/form-sections.tsx` and `form-section-nav.tsx`.

      **The whole right rail sticks, not the Fast menu inside it.** Sticking
      the menu alone was tried first and was wrong: its siblings scrolled up
      underneath it and the Publishing card's heading vanished behind it. Not
      sticking anything was tried next, and jumping to a section then left the
      menu off-screen, so the next jump meant scrolling back up. Moving the
      rail as one unit solves both — nothing inside it moves relative to
      anything else.

      Two details it depends on. `self-start` is load bearing: a grid item
      stretches to its row height by default, which leaves `position: sticky`
      nothing to stick to and silently does nothing. And the rail can outgrow
      the viewport, so it scrolls itself with `overscroll-contain` — without
      that, reaching its end chains the scroll into the page and produces the
      "sticks, then jumps" feel this was meant to remove.

      **The scroll spy reads the observer's own measurements.** Calling
      `getBoundingClientRect()` per section in the callback forced a
      synchronous layout on every scroll tick — eight reflows a frame. Entries
      carry `boundingClientRect`; the result is throttled to one update per
      frame.

      That was one cause of rough scrolling in the admin, not the only one:
      scrolling still stuttered afterwards. The other was `backdrop-blur` on
      the editor's sticky toolbar, which makes the compositor re-sample and
      re-blur everything behind it every frame. It is solid now. If it is ever
      reported again, measure before changing anything — there are no scroll
      listeners anywhere in this codebase, so the cost is compositing or forced
      layout, never a handler.

      **A closed section is hidden, never unmounted.** Tabs or conditional
      rendering would look tidier and would quietly break saving: these forms
      post with `new FormData(event.currentTarget)`, which reads only the
      inputs currently in the DOM, so an unrendered section is a section whose
      fields are silently dropped. Verified rather than assumed — a collapsed
      "The trip" still holds all eighteen of its controls.

      **A rejected save opens every section**, because a collapsed one hides
      its own validation errors, and "fix the highlighted fields" with nothing
      visibly highlighted leaves the editor stuck. One blunt rule beats a map
      from field name to section, which would rot the first time a field moved.

      **The field list under each section is read from the DOM**, not declared
      per form — every `Field` renders a `<label for>`. Controls inside a
      `<fieldset>` are represented by their `<legend>` instead of individually:
      listing the twelve month checkboxes behind "Best season" turned a
      seven-item menu into an eighteen-item one and buried the fields anybody
      would actually navigate to.

      Not added to the post, activity, testimonial or FAQ editors: two or three
      sections do not justify the chrome.

- [x] **Media drawer** — the library docked beside the blog, destination, tour
      and activity editors, with images dragged out onto the featured image, a
      gallery, the SEO image or into the text editor.
      `components/cms/media-drawer.tsx`.
      The fetching lives in `use-media-library.ts`, shared with the picker
      dialog so the two cannot drift; the drag payload is one contract in
      `media-drag.ts`, because five components have to agree on it.

      **A hover highlight tests `dataTransfer.types`, not the payload**: the
      browser refuses `getData()` during `dragover`, so a target that tried to
      read the payload would never light up.

      **The editor checks files before the library payload.** A drag from the
      desktop can also advertise `text/uri-list`, and the other order would
      insert a link to a file that was never uploaded.

- [x] **Dated storage paths** — an upload with no folder is filed under
      `YYYY/MM/DD/HHMMSS/`, keeping the filename it arrived with:
      `2026/09/13/143052/everest-sunrise.jpg`. See the note in
      `lib/storage/adapter.ts` on why the date belongs in the storage key and
      not in the record's flat `folder` field.

      **It is not collision-proof, by choice.** A random serial used to
      guarantee that; the name is preserved instead, so two uploads of the same
      filename in the same second land on one key. Supabase refuses that
      (`upsert: false`) and fails loudly; the local adapter would overwrite
      silently. Second-level precision makes it rare, not impossible.

      The name keeps its case, digits and underscores. Only control characters,
      path separators and the set illegal in a Windows path or a URL are
      stripped — `../` in a filename is a traversal attempt, not a name.

**Not built as blocks, deliberately:** video (an embed is a `<script>` from a
third party and needs a consent decision first), map (same, plus an API key),
features (needs a repeating sub-form the generic field descriptor does not
have), and custom-component (a block that renders arbitrary code is a way to
put a deploy inside the CMS).
- [ ] **Structured data** — automatic JSON-LD for tours (`Trip`/`Product`),
      destinations (`Place`) and posts (`Article`), on top of today's manual field.
- [ ] **Revision history** with restore. The activity log records that a change
      happened; this records what changed.
- [ ] **Wildcard redirects** and hit counters.
- [ ] **Autosave** in the page editor.
- [ ] **Bulk actions** in list views.

---

## Phase 4 — Platform

- [ ] **Verify the remaining live integrations.** The Supabase and Neon
      *database* adapters are verified. Still untested against real accounts:
      - Supabase Auth sign-in
      - Neon Auth (Stack Auth) sign-in
      - Clerk sign-in, provider and middleware wiring
- [x] **Media migration, local → hosted.** `npm run cms:migrate` copies
      records *and* the `public/uploads/` files they reference into the
      configured backend, rewriting URLs. Not built: hosted → hosted (e.g.
      Supabase Storage → S3); the admin Copy data tool still moves records
      only. See docs/DEPLOY-VERCEL-NEON.md §9 for doing it by hand.
- [ ] **Verify the MongoDB adapter** against a live cluster; add index creation
      at `init()`.
- [ ] **Implement the Firebase adapter**, or formally drop it. The file
      documents what makes Firestore awkward for this contract.
- [x] **S3 storage adapter** (`lib/storage/providers/s3.ts`). Verified on
      Neon Object Storage; SigV4 on `node:crypto`, no AWS SDK. Path-style
      URLs, public-read buckets only.
- [ ] **Presigned browser uploads** straight to the bucket, so files over
      Vercel's 4.5 MB request limit can be uploaded. Needs bucket CORS and a
      register-after-upload action; today uploads pass through a Server
      Action and are capped at 4 MB on Vercel.
- [ ] **Shared rate-limit store.** `lib/rate-limit.ts` counts per process,
      which is approximate on serverless hosts.
- [ ] **Custom roles** — edit permission bundles from the admin.
- [ ] **Per-record ownership** so an author edits only their own drafts.
- [ ] **Session revocation** ("sign out everywhere").
- [ ] **CLI** — `create-travel-site <name>` to scaffold a client project.
- [ ] **Multi-tenancy** if it is ever needed. Seams are noted in the code; the
      MVP deliberately does not implement it.
- [ ] **Tests.** `npm test` exists (blog logic, repositories, storage keys).
      Still worth writing: `lib/database/query.ts` (filter/sort/paginate
      semantics), slug normalisation, the permission matrix, and
      publication-window logic.
- [ ] **i18n.** `locales` and `defaultLocale` exist in config so the data model
      can absorb translations without a migration; nothing consumes them yet.

---

## Deliberately out of scope

- **An Integrations screen.** The sidebar carried one as "Soon" without any
  entry here saying what it would do, and the only obvious answer — analytics
  and site-verification IDs — is a card Site Settings has always rendered. A
  greyed-out item is honest when the feature genuinely does not exist; this one
  hid a built feature behind a "Soon" tag instead. Removed from the nav, and
  the module switched off in `cms.config.ts` so it stops appearing as a row in
  the permission matrix. The `RESOURCES` and `CMS_MODULES` keys are left in
  place for a project that wants to build a real one.
- A drag-and-drop visual builder that competes with Elementor.
- Plugin marketplaces, themes, or anything resembling WordPress's extension
  ecosystem.
- Microservices. This is one Next.js app.
- Replacing developers' freedom to write ordinary React and query their own data.
