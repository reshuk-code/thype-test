import "server-only";

import { getDatabase } from "@/lib/database";
import type { SubscriberInput } from "@/schemas/subscriber";
import type { ListOptions, Paginated } from "@/types/common";
import type { Subscriber } from "@/types/content";

import { buildListQuery } from "./base";

async function collection() {
  return (await getDatabase()).collection<Subscriber>("subscribers");
}

/** Hard cap on an export; well beyond a newsletter this project would hold. */
const EXPORT_LIMIT = 50_000;

/**
 * Newsletter signups.
 *
 * Like enquiries, there is no public read: nothing here may be called from a
 * page. `subscribe` is idempotent and says nothing about whether the address
 * was already on the list, so the form cannot be used to test membership.
 */
export const subscribers = {
  async list(options?: ListOptions): Promise<Paginated<Subscriber>> {
    const store = await collection();
    return store.list(
      buildListQuery({ ...options, status: "any", sort: "createdAt" }, ["email", "source"]),
    );
  },

  async count(): Promise<number> {
    return (await collection()).count();
  },

  async subscribe(input: SubscriberInput): Promise<void> {
    const store = await collection();
    const existing = await store.findOne({
      where: [{ field: "email", op: "eq", value: input.email }],
    });
    if (existing) return;

    try {
      await store.create({
        email: input.email,
        source: input.source,
        consentedAt: new Date().toISOString(),
      });
    } catch (error) {
      // Two submissions racing past the check above: the unique index on the
      // SQL backends rejects the second, which is the outcome we wanted.
      const again = await store.findOne({
        where: [{ field: "email", op: "eq", value: input.email }],
      });
      if (!again) throw error;
    }
  },

  /** Everyone, oldest first, for the CSV export. */
  async all(): Promise<Subscriber[]> {
    return (await collection()).findMany({
      sort: [{ field: "createdAt", direction: "asc" }],
      limit: EXPORT_LIMIT,
    });
  },

  async delete(id: string): Promise<boolean> {
    return (await collection()).delete(id);
  },
};
