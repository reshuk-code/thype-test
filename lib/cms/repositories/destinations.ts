import "server-only";

import { ConflictError, NotFoundError } from "@/lib/cms/errors";
import { getDatabase } from "@/lib/database";
import { slugify } from "@/schemas/common";
import type { DestinationInputParsed } from "@/schemas/destination";
import type { FilterCondition, ListOptions, Paginated } from "@/types/common";
import type { Destination } from "@/types/content";

import {
  buildListQuery,
  isPubliclyVisible,
  PUBLIC_STATUS_FILTER,
  resolvePublication,
} from "./base";
import type { WriteContext } from "./pages";

const SEARCH_FIELDS = ["name", "slug", "shortDescription", "country", "region"];

/** Ceiling for the country scan. See the note on `media.folders()`. */
const FACET_SCAN_LIMIT = 2000;

async function collection() {
  return (await getDatabase()).collection<Destination>("destinations");
}

export interface DestinationListOptions extends ListOptions {
  country?: string;
  featured?: boolean;
}

/**
 * Destinations repository.
 *
 * The model a tourism site organises everything else around: tours reference a
 * destination, activities happen in one, and the blog writes about them. It is
 * therefore the first content type where `order` and `featured` earn their
 * keep — a homepage almost always wants "our six headline places, in the order
 * we chose", not "the six most recently edited".
 *
 * Slugs are bare, like posts: the project decides whether they live at
 * `/destinations/everest` or `/nepal/everest`.
 */
export const destinations = {
  async list(options?: DestinationListOptions): Promise<Paginated<Destination>> {
    const store = await collection();
    const query = buildListQuery(options, SEARCH_FIELDS);

    const where: FilterCondition[] = [...(query.where ?? [])];
    if (options?.country) {
      where.push({ field: "country", op: "eq", value: options.country });
    }
    if (options?.featured !== undefined) {
      where.push({ field: "featured", op: "eq", value: options.featured });
    }

    return store.list({
      ...query,
      where: where.length ? where : undefined,
      sort: [
        {
          field: options?.sort || "updatedAt",
          direction: options?.order ?? "desc",
        },
      ],
    });
  },

  async get(id: string): Promise<Destination | null> {
    return (await collection()).findById(id);
  },

  /** Frontend lookup. Drafts and not-yet-due scheduled records return null. */
  async getBySlug(slug: string): Promise<Destination | null> {
    const found = await this.getBySlugIncludingDrafts(slug);
    return found && isPubliclyVisible(found) ? found : null;
  },

  /** Preview/admin lookup: ignores publication state. */
  async getBySlugIncludingDrafts(slug: string): Promise<Destination | null> {
    const store = await collection();
    return store.findOne({
      where: [{ field: "slug", op: "eq", value: slugify(slug) }],
    });
  },

  /** Published destinations in display order — the listing page. */
  async getPublished(
    options?: DestinationListOptions,
  ): Promise<Destination[]> {
    const store = await collection();

    const where: FilterCondition[] = [PUBLIC_STATUS_FILTER];
    if (options?.country) {
      where.push({ field: "country", op: "eq", value: options.country });
    }
    if (options?.featured !== undefined) {
      where.push({ field: "featured", op: "eq", value: options.featured });
    }

    const candidates = await store.findMany({
      where,
      sort: [
        { field: options?.sort ?? "order", direction: options?.order ?? "asc" },
      ],
    });

    const visible = candidates.filter((record) => isPubliclyVisible(record));
    return options?.perPage ? visible.slice(0, options.perPage) : visible;
  },

  /** The homepage set: featured, published, in order. */
  async getFeatured(limit = 6): Promise<Destination[]> {
    return this.getPublished({ featured: true, perPage: limit });
  },

  /**
   * Publicly visible destinations by id, in the order given, in one query.
   * For the places a story is filed under.
   */
  async getPublishedByIds(ids: string[]): Promise<Destination[]> {
    const unique = [...new Set(ids.filter(Boolean))];
    if (unique.length === 0) return [];

    const store = await collection();
    const found = await store.findMany({
      where: [{ field: "id", op: "in", value: unique }],
      limit: unique.length,
    });
    const byId = new Map(
      found.filter((record) => isPubliclyVisible(record)).map((record) => [record.id, record]),
    );
    return unique.flatMap((id) => byId.get(id) ?? []);
  },

  async count(options?: DestinationListOptions): Promise<number> {
    const store = await collection();
    return store.count(buildListQuery(options, SEARCH_FIELDS));
  },

  /** Countries in use, for the filter dropdown and the editor's datalist. */
  async countries(): Promise<string[]> {
    const store = await collection();
    const all = await store.findMany({
      where: [{ field: "status", op: "ne", value: "trash" }],
      limit: FACET_SCAN_LIMIT,
    });

    const names = new Set<string>();
    for (const record of all) {
      if (record.country) names.add(record.country);
    }

    return [...names].sort((a, b) => a.localeCompare(b));
  },

  /** Minimal projection, for the pickers that tours and activities will use. */
  async options(): Promise<{ id: string; name: string; slug: string }[]> {
    const store = await collection();
    const all = await store.findMany({
      where: [{ field: "status", op: "ne", value: "trash" }],
      sort: [{ field: "name", direction: "asc" }],
      limit: FACET_SCAN_LIMIT,
    });

    return all.map(({ id, name, slug }) => ({ id, name, slug }));
  },

  async create(
    input: DestinationInputParsed,
    ctx: WriteContext,
  ): Promise<Destination> {
    const store = await collection();
    await assertSlugFree(input.slug, null);

    return store.create({
      ...fields(input),
      publishedAt: resolvePublication(input.status, input.publishedAt, null),
      updatedBy: ctx.userId,
    });
  },

  async update(
    id: string,
    input: DestinationInputParsed,
    ctx: WriteContext,
  ): Promise<Destination> {
    const store = await collection();
    const existing = await store.findById(id);
    if (!existing) throw new NotFoundError("Destination");

    await assertSlugFree(input.slug, id);

    const updated = await store.update(id, {
      ...fields(input),
      publishedAt: resolvePublication(
        input.status,
        input.publishedAt,
        existing.publishedAt,
      ),
      updatedBy: ctx.userId,
    });

    if (!updated) throw new NotFoundError("Destination");
    return updated;
  },

  async setStatus(
    id: string,
    status: Destination["status"],
    ctx: WriteContext,
  ): Promise<Destination> {
    const store = await collection();
    const existing = await store.findById(id);
    if (!existing) throw new NotFoundError("Destination");

    const updated = await store.update(id, {
      status,
      publishedAt: resolvePublication(status, null, existing.publishedAt),
      updatedBy: ctx.userId,
    });

    if (!updated) throw new NotFoundError("Destination");
    return updated;
  },

  async trash(id: string, ctx: WriteContext): Promise<Destination> {
    return this.setStatus(id, "trash", ctx);
  },

  async delete(id: string): Promise<boolean> {
    return (await collection()).delete(id);
  },

  async duplicate(id: string, ctx: WriteContext): Promise<Destination> {
    const store = await collection();
    const source = await store.findById(id);
    if (!source) throw new NotFoundError("Destination");

    return store.create({
      ...source,
      id: undefined,
      name: `${source.name} (copy)`,
      slug: await findFreeSlug(source.slug),
      faqs: source.faqs?.map((faq) => ({ ...faq, id: crypto.randomUUID() })) ?? [],
      status: "draft",
      publishedAt: null,
      featured: false,
      updatedBy: ctx.userId,
    } as Omit<Destination, "id" | "createdAt" | "updatedAt"> & { id?: string });
  },
};

/** The fields the form owns, shared by create and update. */
function fields(input: DestinationInputParsed) {
  return {
    name: input.name,
    slug: input.slug,
    shortDescription: input.shortDescription,
    description: input.description,
    featuredImage: input.featuredImage,
    featuredImageHorizontal: input.featuredImageHorizontal,
    featuredImageVertical: input.featuredImageVertical,
    bannerImage: input.bannerImage,
    gallery: input.gallery,
    country: input.country,
    region: input.region,
    latitude: input.latitude,
    longitude: input.longitude,
    highlights: input.highlights,
    faqs: input.faqs,
    bestSeason: input.bestSeason,
    typicalDuration: input.typicalDuration,
    featured: input.featured,
    order: input.order,
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
