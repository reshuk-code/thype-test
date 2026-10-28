import "server-only";

import { cache } from "react";

import { pickRelated } from "@/lib/blog/related";
import { findTermBySlug } from "@/lib/blog/taxonomy";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/cms/errors";
import { getDatabase } from "@/lib/database";
import { richDocToPlainText, toRichDoc } from "@/lib/rich-text";
import { applyFilters, applySort, paginate } from "@/lib/database/query";
import { slugify } from "@/schemas/common";
import type { PostInputParsed } from "@/schemas/post";
import type { FilterCondition, ListOptions, Paginated } from "@/types/common";
import type { Author, Destination, Post } from "@/types/content";

import {
  buildListQuery,
  isPubliclyVisible,
  PUBLIC_STATUS_FILTER,
  resolvePublication,
} from "./base";
import type { WriteContext } from "./pages";

const SEARCH_FIELDS = ["title", "slug", "excerpt", "category"];

/** Ceiling for the category/tag scan. See the note on `media.folders()`. */
const FACET_SCAN_LIMIT = 2000;

/** Words per minute. The number every blog platform quietly agrees on. */
const READING_SPEED = 200;

async function collection() {
  return (await getDatabase()).collection<Post>("posts");
}

export interface PostListOptions extends ListOptions {
  category?: string;
  tag?: string;
  /** Admin filter on the credited profile (`authorProfileId`). */
  authorProfileId?: string;
  featured?: boolean;
}

/** Filters for the public listing pages. All optional, all ANDed. */
export interface PublicPostQuery {
  category?: string;
  tag?: string;
  destinationId?: string;
  authorProfileId?: string;
  featured?: boolean;
  /** Case-insensitive match on title, excerpt, category and tags. */
  search?: string;
  page?: number;
  perPage?: number;
}

/** Hard ceiling on a public page size; listing pages ask for far fewer. */
const MAX_PUBLIC_PER_PAGE = 48;

/**
 * Every publicly visible post, newest first, fetched once per request.
 *
 * The homepage alone asks for a lead story, latest posts, a category strip and
 * related reading; a query each would be a handful of round trips that all
 * read the same rows. `cache` dedupes them within one render. Capped like the
 * facet scan: a publication large enough to hit it needs real indexes and
 * server-side filtering, which is the Phase 4 note on `scan()` below.
 *
 * The adapter contract has no projection, so these rows carry their full
 * content. At a few hundred posts that is a few megabytes per uncached render,
 * and public routes are statically cached with revalidation, so it is paid
 * once per publish rather than once per visitor.
 */
const publishedIndex = cache(async (): Promise<Post[]> => {
  const store = await collection();
  const candidates = await store.findMany({
    where: [PUBLIC_STATUS_FILTER],
    sort: [{ field: "publishedAt", direction: "desc" }],
    limit: FACET_SCAN_LIMIT,
  });
  return candidates.filter((post) => isPubliclyVisible(post));
});

/** A post write also records who gets the byline. */
export interface PostWriteContext extends WriteContext {
  /** Display name for `authorName`, captured at write time. */
  authorName?: string | null;
}

/**
 * Blog repository.
 *
 * Mirrors `pages` — same statuses, same publication windows, same slug
 * uniqueness — with two differences that matter:
 *
 * - Slugs are bare ("annapurna-in-october"), not paths. A post has no route of
 *   its own; the developer mounts it wherever the site wants it, typically
 *   `app/blog/[slug]`. Storing "/annapurna-in-october" would bake a URL layout
 *   into the content.
 * - Categories and tags are strings on the post rather than their own
 *   collections. A travel blog has a dozen categories that change twice a
 *   year; two more tables, two more admin screens and a referential-integrity
 *   story would cost far more than they return. `categories()` and `tags()`
 *   derive the facets from the posts themselves.
 */
export const posts = {
  /** Admin listing: every status, paginated, searchable, facet-filtered. */
  async list(options?: PostListOptions): Promise<Paginated<Post>> {
    const store = await collection();
    const query = buildListQuery(options, SEARCH_FIELDS);

    const where: FilterCondition[] = [...(query.where ?? [])];
    if (options?.category) {
      where.push({ field: "category", op: "eq", value: options.category });
    }
    if (options?.authorProfileId) {
      where.push({ field: "authorProfileId", op: "eq", value: options.authorProfileId });
    }
    if (options?.featured !== undefined) {
      where.push({ field: "featured", op: "eq", value: options.featured });
    }

    const spec = { ...query, where: where.length ? where : undefined };

    // Tag membership is the one filter the adapter contract cannot express
    // identically everywhere: `contains` means "the array includes this" in
    // the local engine and "substring" once it becomes SQL, where the tag
    // "trek" would also match a post tagged "trekking". Filtering here keeps
    // it meaning exactly one thing on every backend.
    if (options?.tag) {
      const tag = options.tag;
      const all = await store.findMany({ limit: FACET_SCAN_LIMIT });
      const matching = applyFilters(all, spec).filter((post) =>
        (post.tags ?? []).includes(tag),
      );
      return paginate(applySort(matching, spec.sort), spec);
    }

    return store.list(spec);
  },

  async get(id: string): Promise<Post | null> {
    return (await collection()).findById(id);
  },

  /** Frontend lookup. Drafts and not-yet-due scheduled posts return null. */
  async getBySlug(slug: string): Promise<Post | null> {
    const post = await this.getBySlugIncludingDrafts(slug);
    return post && isPubliclyVisible(post) ? post : null;
  },

  /** Preview/admin lookup: ignores publication state. */
  async getBySlugIncludingDrafts(slug: string): Promise<Post | null> {
    const store = await collection();
    return store.findOne({
      where: [{ field: "slug", op: "eq", value: slugify(slug) }],
    });
  },

  /**
   * Published posts, newest first — the blog index.
   *
   * Scheduled posts are filtered in memory for the same reason as pages: the
   * adapter contract cannot express "published OR (scheduled AND due)".
   */
  async getPublished(options?: PostListOptions): Promise<Post[]> {
    const store = await collection();

    const where: FilterCondition[] = [PUBLIC_STATUS_FILTER];
    if (options?.category) {
      where.push({ field: "category", op: "eq", value: options.category });
    }

    const candidates = await store.findMany({
      where,
      sort: [
        {
          field: options?.sort ?? "publishedAt",
          direction: options?.order ?? "desc",
        },
      ],
    });

    const tag = options?.tag;
    const visible = candidates.filter(
      (post) =>
        isPubliclyVisible(post) && (!tag || (post.tags ?? []).includes(tag)),
    );

    return options?.perPage ? visible.slice(0, options.perPage) : visible;
  },

  /**
   * One page of published posts for a public listing, with the total needed
   * to render a paginator. Runs over the per-request index above.
   */
  async getPublishedPage(query: PublicPostQuery = {}): Promise<Paginated<Post>> {
    const perPage = Math.min(MAX_PUBLIC_PER_PAGE, Math.max(1, query.perPage ?? 12));
    const matching = filterPublic(await publishedIndex(), query);

    const totalPages = Math.max(1, Math.ceil(matching.length / perPage));
    const page = Math.min(Math.max(1, query.page ?? 1), totalPages);
    const start = (page - 1) * perPage;

    return {
      items: matching.slice(start, start + perPage),
      total: matching.length,
      page,
      perPage,
      totalPages,
    };
  },

  /** Published posts flagged as featured, newest first. */
  async getFeatured(limit = 3): Promise<Post[]> {
    return filterPublic(await publishedIndex(), { featured: true }).slice(0, limit);
  },

  /** Published posts by id, in the order given. Unknown or hidden ids drop out. */
  async getPublishedByIds(ids: string[]): Promise<Post[]> {
    if (ids.length === 0) return [];
    const byId = new Map((await publishedIndex()).map((post) => [post.id, post]));
    return ids.flatMap((id) => byId.get(id) ?? []);
  },

  /** What to read after `post`: hand-picked first, then the closest matches. */
  async getRelated(post: Post, limit = 3): Promise<Post[]> {
    return pickRelated(
      { ...post, tags: post.tags ?? [] },
      (await publishedIndex()).map((candidate) => ({
        ...candidate,
        tags: candidate.tags ?? [],
      })),
      post.relatedPostIds ?? [],
      limit,
    );
  },

  /**
   * Categories with at least one published post, and how many.
   *
   * Distinct from `categories()`, which the admin uses and which includes
   * drafts: a category that exists only on an unpublished post must not
   * appear in public navigation, or the site announces a story before it runs.
   */
  async publishedCategories(): Promise<{ name: string; count: number }[]> {
    return countTerms(
      (await publishedIndex()).map((post) => (post.category ? [post.category] : [])),
    );
  },

  /** Tags with at least one published post, most used first. */
  async publishedTags(): Promise<{ name: string; count: number }[]> {
    return countTerms((await publishedIndex()).map((post) => post.tags ?? []));
  },

  /** Resolves a category URL slug to the name posts carry, or null. */
  async categoryBySlug(slug: string): Promise<string | null> {
    const names = (await this.publishedCategories()).map((term) => term.name);
    return findTermBySlug(names, slug);
  },

  /** Resolves a tag URL slug to the tag posts carry, or null. */
  async tagBySlug(slug: string): Promise<string | null> {
    const names = (await this.publishedTags()).map((term) => term.name);
    return findTermBySlug(names, slug);
  },

  /** Published post counts per destination id, for destination listings. */
  async countByDestination(): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    for (const post of await publishedIndex()) {
      for (const id of post.destinationIds ?? []) {
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
    return counts;
  },

  async count(options?: PostListOptions): Promise<number> {
    const store = await collection();
    return store.count(buildListQuery(options, SEARCH_FIELDS));
  },

  /** Every post not in the trash, newest first, for pickers in the admin. */
  async options(): Promise<{ id: string; title: string; status: Post["status"] }[]> {
    const all = await scan();
    return all
      .sort((a, b) => (b.publishedAt ?? b.updatedAt).localeCompare(a.publishedAt ?? a.updatedAt))
      .map(({ id, title, status }) => ({ id, title, status }));
  },

  /** Categories in use, for the filter dropdown and the editor's datalist. */
  async categories(): Promise<string[]> {
    const all = await scan();
    const names = new Set<string>();
    for (const post of all) {
      if (post.category) names.add(post.category);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  },

  /** Tags in use, with how many posts carry each. */
  async tags(): Promise<{ name: string; count: number }[]> {
    const all = await scan();
    const counts = new Map<string, number>();

    for (const post of all) {
      for (const tag of post.tags ?? []) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }

    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  },

  async create(input: PostInputParsed, ctx: PostWriteContext): Promise<Post> {
    const store = await collection();
    await assertSlugFree(input.slug, null);

    return store.create({
      ...fields(input),
      ...(await checkedReferences(input, null)),
      publishedAt: resolvePublication(input.status, input.publishedAt, null),
      updatedBy: ctx.userId,
      authorId: input.authorId ?? ctx.userId,
      authorName: ctx.authorName ?? null,
    });
  },

  async update(
    id: string,
    input: PostInputParsed,
    ctx: PostWriteContext,
  ): Promise<Post> {
    const store = await collection();
    const existing = await store.findById(id);
    if (!existing) throw new NotFoundError("Post");

    await assertSlugFree(input.slug, id);

    const updated = await store.update(id, {
      ...fields(input),
      ...(await checkedReferences(input, id)),
      publishedAt: resolvePublication(
        input.status,
        input.publishedAt,
        existing.publishedAt,
      ),
      updatedBy: ctx.userId,
      authorId: input.authorId,
      // The byline belongs to whoever is credited, not to whoever last saved,
      // so the caller resolves the name for `input.authorId`.
      authorName: ctx.authorName ?? null,
    });

    if (!updated) throw new NotFoundError("Post");
    return updated;
  },

  async setStatus(
    id: string,
    status: Post["status"],
    ctx: WriteContext,
  ): Promise<Post> {
    const store = await collection();
    const existing = await store.findById(id);
    if (!existing) throw new NotFoundError("Post");

    const updated = await store.update(id, {
      status,
      publishedAt: resolvePublication(status, null, existing.publishedAt),
      updatedBy: ctx.userId,
    });

    if (!updated) throw new NotFoundError("Post");
    return updated;
  },

  /** Moves a post to the trash. Reversible; `delete` is not. */
  async trash(id: string, ctx: WriteContext): Promise<Post> {
    return this.setStatus(id, "trash", ctx);
  },

  async delete(id: string): Promise<boolean> {
    return (await collection()).delete(id);
  },

  /** Copies a post as a draft with a free slug. */
  async duplicate(id: string, ctx: WriteContext): Promise<Post> {
    const store = await collection();
    const source = await store.findById(id);
    if (!source) throw new NotFoundError("Post");

    return store.create({
      ...source,
      id: undefined,
      title: `${source.title} (copy)`,
      slug: await findFreeSlug(source.slug),
      status: "draft",
      publishedAt: null,
      // A copy is a starting point, not a second lead story.
      featured: false,
      updatedBy: ctx.userId,
    } as Omit<Post, "id" | "createdAt" | "updatedAt"> & { id?: string });
  },
};

/** The fields a post form owns, shared by create and update. */
function fields(input: PostInputParsed) {
  return {
    title: input.title,
    slug: input.slug,
    excerpt: input.excerpt,
    content: input.content,
    body: input.body,
    featuredImage: input.featuredImage,
    featuredImageAlt: input.featuredImageAlt,
    featuredImageCaption: input.featuredImageCaption,
    featuredImageCredit: input.featuredImageCredit,
    category: input.category,
    tags: input.tags,
    featured: input.featured,
    showToc: input.showToc,
    status: input.status,
    readingMinutes: readingMinutes(input.content),
    seo: input.seo,
  };
}

/** Applies the public listing filters to an already-visible set of posts. */
function filterPublic(all: Post[], query: PublicPostQuery): Post[] {
  const term = query.search?.trim().toLowerCase();

  return all.filter((post) => {
    if (query.category && post.category !== query.category) return false;
    if (query.tag && !(post.tags ?? []).includes(query.tag)) return false;
    if (query.featured !== undefined && Boolean(post.featured) !== query.featured) {
      return false;
    }
    if (query.authorProfileId && post.authorProfileId !== query.authorProfileId) {
      return false;
    }
    if (query.destinationId && !(post.destinationIds ?? []).includes(query.destinationId)) {
      return false;
    }
    if (term) {
      const haystack = [post.title, post.excerpt, post.category, ...(post.tags ?? [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    return true;
  });
}

function countTerms(perPost: string[][]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const terms of perPost) {
    for (const term of new Set(terms)) counts.set(term, (counts.get(term) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/**
 * Validates the ids a post points at, and keeps only the ones that resolve.
 *
 * A byline must name a real profile — a typo there would publish a story
 * credited to nobody — so an unknown author is an error. Destinations and
 * related posts are lists an editor curates over time; one that has since
 * been deleted is dropped quietly rather than blocking an unrelated save.
 */
async function checkedReferences(
  input: PostInputParsed,
  selfId: string | null,
): Promise<Pick<Post, "authorProfileId" | "destinationIds" | "relatedPostIds">> {
  const db = await getDatabase();

  if (input.authorProfileId) {
    const author = await db
      .collection<Author>("authors")
      .findById(input.authorProfileId);
    if (!author || author.status === "trash") {
      throw new ValidationError("That author profile no longer exists.", {
        authorProfileId: ["Pick an existing author profile."],
      });
    }
  }

  const existingIds = async (name: "destinations" | "posts", ids: string[]) => {
    if (ids.length === 0) return [];
    const found = await db.collection<Destination | Post>(name).findMany({
      where: [{ field: "id", op: "in", value: ids }],
      limit: ids.length,
    });
    const live = new Set(
      found.filter((record) => record.status !== "trash").map((record) => record.id),
    );
    return ids.filter((id) => live.has(id));
  };

  return {
    authorProfileId: input.authorProfileId,
    destinationIds: await existingIds("destinations", input.destinationIds),
    relatedPostIds: await existingIds(
      "posts",
      input.relatedPostIds.filter((id) => id !== selfId),
    ),
  };
}

/** Minutes at a typical reading speed, floored at one for any real content. */
function readingMinutes(content: string): number | null {
  // Counted from the document's words, not the stored string: the editor
  // stores a serialised document, and counting that would bill the reader for
  // every `{"type":"paragraph"}` in it.
  const words = richDocToPlainText(toRichDoc(content))
    .split(/\s+/)
    .filter(Boolean).length;
  if (words === 0) return null;
  return Math.max(1, Math.round(words / READING_SPEED));
}

/**
 * Every post that is not in the trash, for deriving facets.
 *
 * Unpaginated by design and capped: a blog large enough to hit the cap needs
 * real taxonomy tables, and that is a Phase 4 conversation.
 */
async function scan(): Promise<Post[]> {
  const store = await collection();
  return store.findMany({
    where: [{ field: "status", op: "ne", value: "trash" }],
    limit: FACET_SCAN_LIMIT,
  });
}

async function assertSlugFree(slug: string, ignoreId: string | null) {
  const store = await collection();
  const existing = await store.findOne({
    where: [{ field: "slug", op: "eq", value: slug }],
  });

  if (existing && existing.id !== ignoreId) {
    throw new ConflictError(
      `The slug "${slug}" is already used by "${existing.title}".`,
      "slug",
    );
  }
}

async function findFreeSlug(base: string): Promise<string> {
  const store = await collection();

  for (let suffix = 2; suffix < 100; suffix += 1) {
    const candidate = slugify(`${base}-${suffix}`);
    const taken = await store.findOne({
      where: [{ field: "slug", op: "eq", value: candidate }],
    });
    if (!taken) return candidate;
  }

  return slugify(`${base}-${Date.now()}`);
}
