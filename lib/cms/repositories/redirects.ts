import "server-only";

import { ConflictError, NotFoundError } from "@/lib/cms/errors";
import { getDatabase } from "@/lib/database";
import type { ListOptions, Paginated } from "@/types/common";
import type { Redirect } from "@/types/settings";

import { buildListQuery } from "./base";

const SEARCH_FIELDS = ["source", "destination"];

async function collection() {
  return (await getDatabase()).collection<Redirect>("redirects");
}

function normalisePath(value: string): string {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withSlash.length > 1 ? withSlash.replace(/\/+$/, "") : "/";
}

/**
 * Redirects repository.
 *
 * Lookups happen in `middleware.ts` on requests that would otherwise 404, so
 * `match()` is on the hot path and stays a single indexed equality query.
 * Pattern/wildcard redirects are deliberately out of scope for the MVP.
 *
 * TODO(phase-3): wildcard and regex sources, plus hit counters.
 */
export const redirects = {
  async list(options?: ListOptions): Promise<Paginated<Redirect>> {
    const store = await collection();
    return store.list({
      ...buildListQuery(options, SEARCH_FIELDS),
      where: undefined,
      sort: [{ field: options?.sort ?? "source", direction: options?.order ?? "asc" }],
    });
  },

  async get(id: string): Promise<Redirect | null> {
    return (await collection()).findById(id);
  },

  /** Returns the active redirect for a pathname, or null. */
  async match(pathname: string): Promise<Redirect | null> {
    const store = await collection();
    const found = await store.findOne({
      where: [{ field: "source", op: "eq", value: normalisePath(pathname) }],
    });
    return found?.enabled ? found : null;
  },

  async create(input: {
    source: string;
    destination: string;
    permanent: boolean;
    enabled: boolean;
  }): Promise<Redirect> {
    const store = await collection();
    const source = normalisePath(input.source);

    const clash = await store.findOne({
      where: [{ field: "source", op: "eq", value: source }],
    });
    if (clash) {
      throw new ConflictError(
        `A redirect from "${source}" already exists.`,
        "source",
      );
    }

    return store.create({
      source,
      destination: normalisePath(input.destination),
      permanent: input.permanent,
      enabled: input.enabled,
    });
  },

  async update(
    id: string,
    input: {
      source: string;
      destination: string;
      permanent: boolean;
      enabled: boolean;
    },
  ): Promise<Redirect> {
    const store = await collection();
    const source = normalisePath(input.source);

    const clash = await store.findOne({
      where: [{ field: "source", op: "eq", value: source }],
    });
    if (clash && clash.id !== id) {
      throw new ConflictError(
        `A redirect from "${source}" already exists.`,
        "source",
      );
    }

    const updated = await store.update(id, {
      source,
      destination: normalisePath(input.destination),
      permanent: input.permanent,
      enabled: input.enabled,
    });

    if (!updated) throw new NotFoundError("Redirect");
    return updated;
  },

  async delete(id: string): Promise<boolean> {
    return (await collection()).delete(id);
  },

  /**
   * Content that lived at `from` now lives at `to`: keep old links working.
   *
   * Three steps, in an order that matters:
   * 1. A rule *from* the new address is dropped. Content there wins anyway,
   *    and left in place it would become a loop the moment step 2 ran on a
   *    record renamed back to a slug it once had.
   * 2. Rules that pointed at the old address are retargeted, so a twice-moved
   *    post costs a visitor one hop rather than a chain.
   * 3. `from` → `to` is created, or an existing rule from `from` updated.
   *
   * The caller decides the paths: the CMS stores bare slugs and does not know
   * whether a post lives at /blog/x or /stories/x.
   */
  async recordMove(from: string, to: string): Promise<void> {
    const source = normalisePath(from);
    const destination = normalisePath(to);
    if (source === destination) return;

    const store = await collection();

    const fromNewAddress = await store.findOne({
      where: [{ field: "source", op: "eq", value: destination }],
    });
    if (fromNewAddress) await store.delete(fromNewAddress.id);

    const pointingAtOld = await store.findMany({
      where: [{ field: "destination", op: "eq", value: source }],
    });
    for (const rule of pointingAtOld) {
      if (rule.source === destination) continue;
      await store.update(rule.id, { destination });
    }

    const existing = await store.findOne({
      where: [{ field: "source", op: "eq", value: source }],
    });
    if (existing) {
      await store.update(existing.id, { destination, permanent: true, enabled: true });
    } else {
      await store.create({ source, destination, permanent: true, enabled: true });
    }
  },
};
