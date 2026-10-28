import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { pickRelated, relatedScore } from "@/lib/blog/related";
import { findTermBySlug, termSlug } from "@/lib/blog/taxonomy";
import { hit } from "@/lib/rate-limit";
import { buildToc, headingAnchors } from "@/lib/rich-text-anchors";
import { serializeJsonLd } from "@/lib/seo/structured-data";
import { authorInputSchema } from "@/schemas/author";
import { postInputWithRulesSchema } from "@/schemas/post";
import type { RichDoc } from "@/types/rich-text";

const heading = (level: number, text: string) => ({
  type: "heading",
  attrs: { level },
  content: [{ type: "text", text }],
});
const para = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });

describe("table of contents anchors", () => {
  const doc: RichDoc = {
    type: "doc",
    content: [
      heading(2, "Getting there"),
      para("…"),
      heading(3, "By train"),
      heading(2, "Getting there"),
      heading(4, "Too deep"),
      heading(2, "Main content"),
      heading(2, "Café & Crêpes!"),
    ],
  };

  it("gives duplicate headings distinct ids in document order", () => {
    const ids = [...headingAnchors(doc).values()];
    assert.deepEqual(ids.slice(0, 3), ["getting-there", "by-train", "getting-there-2"]);
  });

  it("never reuses the skip link's id", () => {
    assert.equal(headingAnchors(doc).get(5), "main-content-2");
  });

  it("strips accents and punctuation", () => {
    assert.equal(headingAnchors(doc).get(6), "cafe-crepes");
  });

  it("lists h2 and h3 only, with ids matching the renderer's", () => {
    const toc = buildToc(doc);
    assert.deepEqual(
      toc.map((entry) => [entry.level, entry.id]),
      [
        [2, "getting-there"],
        [3, "by-train"],
        [2, "getting-there-2"],
        [2, "main-content-2"],
        [2, "cafe-crepes"],
      ],
    );
  });
});

describe("related posts", () => {
  const post = { id: "p", category: "Europe", tags: ["food"], destinationIds: ["rome"], publishedAt: "2026-01-01" };
  const pool = [
    { id: "p", category: "Europe", tags: [], destinationIds: [], publishedAt: "2026-01-01" },
    { id: "same-place", category: "Asia", tags: [], destinationIds: ["rome"], publishedAt: "2025-01-01" },
    { id: "same-category", category: "Europe", tags: [], destinationIds: [], publishedAt: "2025-06-01" },
    { id: "shared-tag", category: null, tags: ["food"], destinationIds: [], publishedAt: "2025-06-01" },
    { id: "unrelated-new", category: null, tags: [], destinationIds: [], publishedAt: "2026-06-01" },
  ];

  it("weights destination over category over tag", () => {
    assert.ok(relatedScore(post, pool[1]) > relatedScore(post, pool[2]));
    assert.ok(relatedScore(post, pool[2]) > relatedScore(post, pool[3]));
  });

  it("puts hand-picked posts first, never repeats, never returns the post itself", () => {
    const picked = pickRelated(post, pool, ["shared-tag", "p", "missing", "shared-tag"], 3);
    assert.deepEqual(picked.map((p) => p.id), ["shared-tag", "same-place", "same-category"]);
  });

  it("falls back to the latest when nothing matches", () => {
    const loner = { id: "x", category: "Mars", tags: [], destinationIds: [], publishedAt: null };
    assert.equal(pickRelated(loner, pool, [], 1)[0].id, "unrelated-new");
  });
});

describe("category and tag slugs", () => {
  it("resolves a URL slug back to the stored name", () => {
    assert.equal(termSlug("Travel Guides"), "travel-guides");
    assert.equal(findTermBySlug(["Europe", "Travel Guides"], "travel-guides"), "Travel Guides");
    assert.equal(findTermBySlug(["Europe"], "asia"), null);
    assert.equal(findTermBySlug(["Europe"], ""), null);
  });
});

describe("JSON-LD serialisation", () => {
  it("cannot close its own script tag", () => {
    const out = serializeJsonLd({ headline: "</script><script>alert(1)</script>" });
    assert.ok(!out.includes("</script>"));
    assert.equal(JSON.parse(out).headline, "</script><script>alert(1)</script>");
  });
});

describe("rate limiting", () => {
  it("allows the limit within a window, then blocks, then resets", () => {
    const key = `test:${Math.random()}`;
    assert.equal(hit(key, 2, 1000, 0), true);
    assert.equal(hit(key, 2, 1000, 10), true);
    assert.equal(hit(key, 2, 1000, 20), false);
    assert.equal(hit(key, 2, 1000, 1001), true);
  });
});

describe("post input rules", () => {
  const base = { title: "A story", slug: "", content: "", status: "draft" };

  it("requires alt text when there is a featured image", () => {
    const result = postInputWithRulesSchema.safeParse({ ...base, slug: "a", featuredImage: "/uploads/a.jpg" });
    assert.equal(result.success, false);
    assert.ok(result.error?.issues.some((issue) => issue.path.join(".") === "featuredImageAlt"));
  });

  it("needs a date to schedule", () => {
    const result = postInputWithRulesSchema.safeParse({ ...base, slug: "a", status: "scheduled" });
    assert.equal(result.success, false);
  });

  it("de-duplicates and caps related ids", () => {
    const parsed = postInputWithRulesSchema.parse({
      ...base,
      slug: "a",
      relatedPostIds: ["1", "1", "2", "3", "4", "5", "6", "7"],
    });
    assert.deepEqual(parsed.relatedPostIds, ["1", "2", "3", "4", "5", "6"]);
  });
});

describe("author links", () => {
  it("accepts https and drops blanks", () => {
    const parsed = authorInputSchema.parse({
      name: "A",
      slug: "a",
      links: { website: "https://example.com", instagram: "" },
    });
    assert.deepEqual(parsed.links, { website: "https://example.com" });
  });

  it("rejects script and relative URLs", () => {
    for (const bad of ["javascript:alert(1)", "/profile", "ftp://x.test"]) {
      const result = authorInputSchema.safeParse({ name: "A", slug: "a", links: { website: bad } });
      assert.equal(result.success, false, bad);
    }
  });
});
