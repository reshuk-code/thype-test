/**
 * The database contract every backend must satisfy.
 *
 * Design notes
 * ------------
 * 1. The interface is deliberately *narrow*. Supabase (Postgres), MongoDB and
 *    Firestore do not have the same query capabilities; anything that only one
 *    of them can do is not in here. Richer behaviour is composed above this
 *    layer, in `lib/cms/repositories/*`.
 * 2. Adapters expose generic collections rather than one method per content
 *    type. That keeps a new adapter to a few hundred lines instead of a few
 *    thousand, and means adding a content model needs no adapter changes.
 * 3. Records are plain JSON-serialisable objects. Adapters own the translation
 *    between their native representation (Postgres rows, BSON documents,
 *    Firestore snapshots) and these shapes.
 */
import type {
  BaseRecord,
  Paginated,
  QuerySpec,
} from "@/types/common";

/** Every logical collection the CMS core knows about. */
export const COLLECTIONS = [
  "pages",
  "posts",
  "authors",
  "destinations",
  "regions",
  "tours",
  "activities",
  "testimonials",
  "faqs",
  "media",
  "menus",
  "redirects",
  "users",
  "enquiries",
  "subscribers",
  "activity_log",
] as const;

export type CollectionName = (typeof COLLECTIONS)[number];

/** Payload accepted by `create`: the record minus fields the store owns. */
export type CreateInput<T extends BaseRecord> = Omit<
  T,
  "id" | "createdAt" | "updatedAt"
> & { id?: string };

/** Payload accepted by `update`: any subset of the mutable fields. */
export type UpdateInput<T extends BaseRecord> = Partial<
  Omit<T, "id" | "createdAt">
>;

export interface CollectionStore<T extends BaseRecord> {
  /** Paginated read. `total` must reflect the filter, not the page. */
  list(query?: QuerySpec): Promise<Paginated<T>>;
  /** Unpaginated read. Use only where the result set is known to be small. */
  findMany(query?: QuerySpec): Promise<T[]>;
  findById(id: string): Promise<T | null>;
  /** First record matching the query, or null. */
  findOne(query: QuerySpec): Promise<T | null>;
  count(query?: QuerySpec): Promise<number>;
  create(data: CreateInput<T>): Promise<T>;
  update(id: string, data: UpdateInput<T>): Promise<T | null>;
  delete(id: string): Promise<boolean>;
}

/**
 * Small key/value area for singletons (site settings, onboarding flags).
 * Modelling these as a collection would force every adapter to invent an id.
 */
export interface KeyValueStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface AdapterHealth {
  ok: boolean;
  provider: string;
  message: string;
  /** Extra diagnostics shown on /admin/database. Never include secrets. */
  details?: Record<string, string | number | boolean>;
}

export interface DatabaseAdapter {
  readonly provider: string;
  /**
   * Called once before first use. Adapters that need a connection or schema
   * check do it here. Must be idempotent.
   */
  init(): Promise<void>;
  collection<T extends BaseRecord>(name: CollectionName): CollectionStore<T>;
  kv: KeyValueStore;
  health(): Promise<AdapterHealth>;
}

/** Thrown when an adapter is selected but not usable. */
export class AdapterNotConfiguredError extends Error {
  constructor(provider: string, reason: string) {
    super(
      `The "${provider}" database adapter is not usable: ${reason}\n` +
        `See docs/ARCHITECTURE.md ("Adapter architecture") and .env.example.`,
    );
    this.name = "AdapterNotConfiguredError";
  }
}
