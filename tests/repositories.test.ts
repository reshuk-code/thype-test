/**
 * Repository behaviour against the local JSON adapter, in a throwaway folder.
 *
 * These are the rules the public site relies on for safety: drafts and
 * not-yet-due posts never resolve publicly, slugs stay unique, an author's
 * private account link never leaves the repository, and recorded redirects
 * cannot loop.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

const workdir = mkdtempSync(path.join(tmpdir(), "thype-test-"));
const originalCwd = process.cwd();

// The local adapter resolves .cms-data/ from the working directory when it is
// first imported, so the switch has to happen before the dynamic imports below.
process.chdir(workdir);
process.env.CMS_DATABASE = "local";
delete process.env.NEXT_PUBLIC_SITE_URL;

const { posts } = await import("@/lib/cms/repositories/posts");
const { authors } = await import("@/lib/cms/repositories/authors");
const { redirects } = await import("@/lib/cms/repositories/redirects");
const { postInputSchema } = await import("@/schemas/post");
const { authorInputSchema } = await import("@/schemas/author");

after(() => {
  process.chdir(originalCwd);
  rmSync(workdir, { recursive: true, force: true });
});

const ctx = { userId: "user-1", authorName: "Tester" };
const input = (overrides: Record<string, unknown>) =>
  postInputSchema.parse({ title: "Story", content: "", ...overrides });

describe("post visibility", () => {
  let draftId = "";

  before(async () => {
    draftId = (await posts.create(input({ slug: "draft-story", status: "draft" }), ctx)).id;
    await posts.create(input({ slug: "live-story", status: "published" }), ctx);
    await posts.create(
      input({
        slug: "future-story",
        status: "scheduled",
        publishedAt: new Date(Date.now() + 86_400_000).toISOString(),
      }),
      ctx,
    );
    await posts.create(
      input({
        slug: "due-story",
        status: "scheduled",
        publishedAt: new Date(Date.now() - 60_000).toISOString(),
      }),
      ctx,
    );
    await posts.create(input({ slug: "old-story", status: "archived" }), ctx);
  });

  it("hides drafts, future and archived posts from public lookups", async () => {
    assert.equal(await posts.getBySlug("draft-story"), null);
    assert.equal(await posts.getBySlug("future-story"), null);
    assert.equal(await posts.getBySlug("old-story"), null);
    assert.ok(await posts.getBySlug("live-story"));
    assert.ok(await posts.getBySlug("due-story"), "a scheduled post goes live once due");
  });

  it("still finds drafts for preview", async () => {
    assert.equal((await posts.getBySlugIncludingDrafts("draft-story"))?.id, draftId);
  });

  it("lists only visible posts publicly", async () => {
    const page = await posts.getPublishedPage({ perPage: 48 });
    assert.deepEqual(
      page.items.map((post) => post.slug).sort(),
      ["due-story", "live-story"],
    );
  });

  it("never exposes a draft's category in public facets", async () => {
    await posts.create(input({ slug: "secret", status: "draft", category: "Unannounced" }), ctx);
    const names = (await posts.publishedCategories()).map((term) => term.name);
    assert.ok(!names.includes("Unannounced"));
    assert.ok((await posts.categories()).includes("Unannounced"), "the admin still sees it");
  });
});

describe("post slugs and references", () => {
  it("rejects a slug that is already taken", async () => {
    await posts.create(input({ slug: "taken" }), ctx);
    await assert.rejects(() => posts.create(input({ slug: "taken" }), ctx), /already used/);
  });

  it("refuses an author profile that does not exist", async () => {
    await assert.rejects(
      () => posts.create(input({ slug: "ghost-author", authorProfileId: "nope" }), ctx),
      /no longer exists/,
    );
  });

  it("drops related ids that do not resolve, and the post itself", async () => {
    const other = await posts.create(input({ slug: "other" }), ctx);
    const created = await posts.create(
      input({ slug: "with-related", relatedPostIds: [other.id, "missing"] }),
      ctx,
    );
    assert.deepEqual(created.relatedPostIds, [other.id]);

    const updated = await posts.update(
      created.id,
      input({ slug: "with-related", relatedPostIds: [created.id, other.id] }),
      ctx,
    );
    assert.deepEqual(updated.relatedPostIds, [other.id]);
  });
});

describe("author profiles", () => {
  it("strips the private account link from public reads", async () => {
    await authors.create(
      authorInputSchema.parse({ name: "Ada", slug: "ada", status: "published", userId: "acct-1" }),
      { userId: "user-1" },
    );
    const publicAuthor = await authors.getBySlug("ada");
    assert.ok(publicAuthor);
    assert.equal("userId" in publicAuthor, false);
    assert.equal("updatedBy" in publicAuthor, false);
  });

  it("allows one profile per account", async () => {
    await assert.rejects(
      () =>
        authors.create(
          authorInputSchema.parse({ name: "Ada 2", slug: "ada-2", userId: "acct-1" }),
          { userId: "user-1" },
        ),
      /already linked/,
    );
  });

  it("hides unpublished profiles", async () => {
    await authors.create(authorInputSchema.parse({ name: "Draft", slug: "draft-author" }), {
      userId: "user-1",
    });
    assert.equal(await authors.getBySlug("draft-author"), null);
  });
});

describe("recorded redirects", () => {
  it("follows renames in one hop and never loops when a slug is reused", async () => {
    await redirects.recordMove("/blog/a", "/blog/b");
    await redirects.recordMove("/blog/b", "/blog/c");
    assert.equal((await redirects.match("/blog/a"))?.destination, "/blog/c", "chain flattened");

    // Renamed back to a slug it once had.
    await redirects.recordMove("/blog/c", "/blog/a");
    assert.equal(await redirects.match("/blog/a"), null, "live content is never redirected");
    assert.equal((await redirects.match("/blog/b"))?.destination, "/blog/a");
    assert.equal((await redirects.match("/blog/c"))?.destination, "/blog/a");
  });
});
