import "server-only";

import { ConflictError, NotFoundError, ValidationError } from "@/lib/cms/errors";
import { getDatabase } from "@/lib/database";
import { slugify } from "@/schemas/common";
import type { AuthorInputParsed } from "@/schemas/author";
import type { ListOptions, Paginated } from "@/types/common";
import type { Author, PublicAuthor } from "@/types/content";

import {
  buildListQuery,
  isPubliclyVisible,
  PUBLIC_STATUS_FILTER,
  resolvePublication,
} from "./base";
import type { WriteContext } from "./pages";

const SEARCH_FIELDS = ["name", "slug", "jobTitle"];

/** A newsroom has dozens of bylines, not thousands. See `media.folders()`. */
const SCAN_LIMIT = 2000;

async function collection() {
  return (await getDatabase()).collection<Author>("authors");
}

/**
 * Strips what the public must not see.
 *
 * The link to a CMS account is the only private field today, but the public
 * methods below return this projection rather than the record so a private
 * field added later is hidden by default instead of leaked by default.
 */
export function toPublicAuthor(author: Author): PublicAuthor {
  const { userId, updatedBy, ...rest } = author;
  return rest;
}

/**
 * Authors repository — public bylines.
 *
 * Slugs are bare (`maya-sharma`); the project mounts profiles where it likes.
 * Posts reference an author by id (`Post.authorProfileId`) and also keep the
 * name they were published under, so deleting a profile cannot blank a byline.
 */
export const authors = {
  async list(options?: ListOptions): Promise<Paginated<Author>> {
    const store = await collection();
    return store.list(buildListQuery(options, SEARCH_FIELDS));
  },

  async get(id: string): Promise<Author | null> {
    return (await collection()).findById(id);
  },

  /** Frontend lookup. Unpublished profiles return null. */
  async getBySlug(slug: string): Promise<PublicAuthor | null> {
    const found = await this.getBySlugIncludingDrafts(slug);
    return found && isPubliclyVisible(found) ? toPublicAuthor(found) : null;
  },

  /** Preview/admin lookup: ignores publication state. */
  async getBySlugIncludingDrafts(slug: string): Promise<Author | null> {
    const store = await collection();
    return store.findOne({
      where: [{ field: "slug", op: "eq", value: slugify(slug) }],
    });
  },

  /** Published profiles, alphabetical. */
  async getPublished(): Promise<PublicAuthor[]> {
    const store = await collection();
    const candidates = await store.findMany({
      where: [PUBLIC_STATUS_FILTER],
      sort: [{ field: "name", direction: "asc" }],
      limit: SCAN_LIMIT,
    });
    return candidates
      .filter((author) => isPubliclyVisible(author))
      .map(toPublicAuthor);
  },

  /**
   * Published profiles by id, for resolving bylines on a list of posts in one
   * query rather than one per card.
   */
  async getPublishedByIds(ids: string[]): Promise<Map<string, PublicAuthor>> {
    const unique = [...new Set(ids.filter(Boolean))];
    if (unique.length === 0) return new Map();

    const store = await collection();
    const found = await store.findMany({
      where: [{ field: "id", op: "in", value: unique }],
      limit: unique.length,
    });

    return new Map(
      found
        .filter((author) => isPubliclyVisible(author))
        .map((author) => [author.id, toPublicAuthor(author)]),
    );
  },

  /** Every non-trashed profile, for the post editor's byline picker. */
  async options(): Promise<
    { id: string; name: string; userId: string | null; status: Author["status"] }[]
  > {
    const store = await collection();
    const all = await store.findMany({
      where: [{ field: "status", op: "ne", value: "trash" }],
      sort: [{ field: "name", direction: "asc" }],
      limit: SCAN_LIMIT,
    });
    return all.map(({ id, name, userId, status }) => ({ id, name, userId, status }));
  },

  async count(options?: ListOptions): Promise<number> {
    const store = await collection();
    return store.count(buildListQuery(options, SEARCH_FIELDS));
  },

  async create(input: AuthorInputParsed, ctx: WriteContext): Promise<Author> {
    const store = await collection();
    await assertSlugFree(input.slug, null);
    await assertAccountFree(input.userId, null);

    return store.create({
      ...fields(input),
      publishedAt: resolvePublication(input.status, input.publishedAt, null),
      updatedBy: ctx.userId,
    });
  },

  async update(
    id: string,
    input: AuthorInputParsed,
    ctx: WriteContext,
  ): Promise<Author> {
    const store = await collection();
    const existing = await store.findById(id);
    if (!existing) throw new NotFoundError("Author");

    await assertSlugFree(input.slug, id);
    await assertAccountFree(input.userId, id);

    const updated = await store.update(id, {
      ...fields(input),
      publishedAt: resolvePublication(
        input.status,
        input.publishedAt,
        existing.publishedAt,
      ),
      updatedBy: ctx.userId,
    });

    if (!updated) throw new NotFoundError("Author");
    return updated;
  },

  async setStatus(
    id: string,
    status: Author["status"],
    ctx: WriteContext,
  ): Promise<Author> {
    const store = await collection();
    const existing = await store.findById(id);
    if (!existing) throw new NotFoundError("Author");

    const updated = await store.update(id, {
      status,
      publishedAt: resolvePublication(status, null, existing.publishedAt),
      updatedBy: ctx.userId,
    });

    if (!updated) throw new NotFoundError("Author");
    return updated;
  },

  async trash(id: string, ctx: WriteContext): Promise<Author> {
    return this.setStatus(id, "trash", ctx);
  },

  async delete(id: string): Promise<boolean> {
    return (await collection()).delete(id);
  },

  async duplicate(id: string, ctx: WriteContext): Promise<Author> {
    const store = await collection();
    const source = await store.findById(id);
    if (!source) throw new NotFoundError("Author");

    return store.create({
      ...source,
      id: undefined,
      name: `${source.name} (copy)`,
      slug: await findFreeSlug(source.slug),
      // One account, one profile: the copy must not claim it too.
      userId: null,
      status: "draft",
      publishedAt: null,
      updatedBy: ctx.userId,
    } as Omit<Author, "id" | "createdAt" | "updatedAt"> & { id?: string });
  },
};

function fields(input: AuthorInputParsed) {
  return {
    name: input.name,
    slug: input.slug,
    jobTitle: input.jobTitle,
    bio: input.bio,
    avatar: input.avatar,
    links: input.links,
    userId: input.userId,
    status: input.status,
    seo: input.seo,
  };
}

async function assertSlugFree(slug: string, ignoreId: string | null) {
  const store = await collection();
  const existing = await store.findOne({
    where: [{ field: "slug", op: "eq", value: slug }],
  });

  if (existing && existing.id !== ignoreId) {
    throw new ConflictError(
      `The slug "${slug}" is already used by "${existing.name}".`,
      "slug",
    );
  }
}

/**
 * An account maps to at most one profile, or "default to my byline" in the
 * post editor would have to guess which one.
 */
async function assertAccountFree(userId: string | null, ignoreId: string | null) {
  if (!userId) return;

  const store = await collection();
  const existing = await store.findOne({
    where: [{ field: "userId", op: "eq", value: userId }],
  });

  if (existing && existing.id !== ignoreId) {
    throw new ValidationError(
      `That account is already linked to the profile "${existing.name}".`,
      { userId: ["That account already has a profile."] },
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
