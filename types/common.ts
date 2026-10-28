/**
 * Primitive/shared types used across every CMS content model.
 *
 * These types are intentionally storage-agnostic: nothing here knows about
 * Supabase, MongoDB or Firebase. Adapters translate to/from these shapes.
 */

/** Every record is addressed by an opaque string id. */
export type ID = string;

/**
 * Editorial lifecycle of a content record.
 * Mirrors WordPress vocabulary on purpose (see docs/ARCHITECTURE.md).
 */
export const CONTENT_STATUSES = [
  "draft",
  "published",
  "scheduled",
  // Retired from the public site but kept out of the trash, so it is neither
  // mistaken for an unfinished draft nor purged with the deleted records.
  "archived",
  "trash",
] as const;

export type ContentStatus = (typeof CONTENT_STATUSES)[number];

/** Fields every stored record carries. */
export interface BaseRecord {
  id: ID;
  createdAt: string;
  updatedAt: string;
}

/** Fields every publicly addressable content record carries. */
export interface ContentRecord extends BaseRecord {
  status: ContentStatus;
  /** ISO date. Set when published, or the scheduled publication time. */
  publishedAt: string | null;
  /** User id of the last editor, when known. */
  updatedBy: ID | null;
}

export type SortDirection = "asc" | "desc";

/**
 * Comparison operators supported by *every* adapter.
 *
 * Deliberately minimal. Supabase (Postgres), MongoDB and Firestore do not have
 * identical query capabilities, so this is the lowest common denominator that
 * all three implement natively. Anything richer belongs in CMS-level code or a
 * provider-specific escape hatch, not in this interface.
 */
export type FilterOperator =
  | "eq"
  | "ne"
  | "in"
  | "lt"
  | "lte"
  | "gt"
  | "gte"
  | "contains";

export interface FilterCondition {
  field: string;
  op: FilterOperator;
  value: unknown;
}

export interface SortSpec {
  field: string;
  direction: SortDirection;
}

/** A storage-level query. All `where` conditions are ANDed together. */
export interface QuerySpec {
  where?: FilterCondition[];
  /** Case-insensitive substring match across the listed fields (ORed). */
  search?: { term: string; fields: string[] };
  sort?: SortSpec[];
  limit?: number;
  offset?: number;
}

/** A page of results plus the information needed to render a paginator. */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

/** Options accepted by the high-level `cms.*.list()` methods. */
export interface ListOptions {
  page?: number;
  perPage?: number;
  search?: string;
  status?: ContentStatus | "any";
  sort?: string;
  order?: SortDirection;
  /** Extra equality filters, e.g. `{ destinationId: "abc" }`. */
  filters?: Record<string, unknown>;
}

/** Rows an admin list shows before the editor asks for more. */
export const DEFAULT_PER_PAGE = 20;

/**
 * The most rows one request may ask for.
 *
 * The list UI grows its window by `DEFAULT_PER_PAGE` at a time rather than
 * paging, so `perPage` is what the "Load next 20" button increments — which
 * makes this the point where growing stops and real paging takes over. It is a
 * bound on work per request, not a preference: `list()` fetches the whole page
 * into memory in every adapter, so an unbounded value is a query string away
 * from flattening the server.
 */
export const MAX_PER_PAGE = 200;
