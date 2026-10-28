import "server-only";

import { getDatabase } from "@/lib/database";
import { ConflictError, NotFoundError } from "@/lib/cms/errors";
import type { MenuInput } from "@/schemas/navigation";
import type { Menu, MenuItem, ResolvedMenuItem } from "@/types/navigation";
import type { CmsPage } from "@/types/page";

import { isPubliclyVisible } from "./base";

async function collection() {
  return (await getDatabase()).collection<Menu>("menus");
}

/**
 * Navigation repository.
 *
 * The CMS stores menu *structure* and resolves it to hrefs. It deliberately
 * says nothing about markup: the frontend gets `ResolvedMenuItem[]` and renders
 * whatever it likes (§12).
 */
export const navigation = {
  async listMenus(): Promise<Menu[]> {
    const store = await collection();
    return store.findMany({ sort: [{ field: "name", direction: "asc" }] });
  },

  async getMenu(key: string): Promise<Menu | null> {
    const store = await collection();
    return store.findOne({ where: [{ field: "key", op: "eq", value: key }] });
  },

  async getMenuById(id: string): Promise<Menu | null> {
    return (await collection()).findById(id);
  },

  /**
   * The frontend entry point: `cms.navigation.get("main")`.
   *
   * Page links resolve to the page's *current* slug, so renaming a page updates
   * every menu that points at it. Items whose target has been deleted or
   * unpublished are dropped rather than rendered as dead links.
   */
  async get(key: string): Promise<ResolvedMenuItem[]> {
    const menu = await this.getMenu(key);
    if (!menu) return [];

    const db = await getDatabase();
    const pageStore = db.collection<CmsPage>("pages");
    const pageIds = collectPageIds(menu.items);

    const pages = await Promise.all(
      [...pageIds].map((id) => pageStore.findById(id)),
    );
    const pagesById = new Map(
      pages.filter((page): page is CmsPage => page !== null).map((p) => [p.id, p]),
    );

    return resolveItems(menu.items, pagesById);
  },

  async create(input: MenuInput): Promise<Menu> {
    const store = await collection();
    const key = input.key.trim();

    if (await this.getMenu(key)) {
      throw new ConflictError(`A menu with the key "${key}" already exists.`, "key");
    }

    return store.create({
      key,
      name: input.name.trim(),
      items: (input.items ?? []) as MenuItem[],
    });
  },

  async update(id: string, input: MenuInput): Promise<Menu> {
    const store = await collection();
    const existing = await store.findById(id);
    if (!existing) throw new NotFoundError("Menu");

    const key = input.key.trim();
    const clash = await this.getMenu(key);
    if (clash && clash.id !== id) {
      throw new ConflictError(`A menu with the key "${key}" already exists.`, "key");
    }

    const updated = await store.update(id, {
      key,
      name: input.name.trim(),
      items: (input.items ?? []) as MenuItem[],
    });

    if (!updated) throw new NotFoundError("Menu");
    return updated;
  },

  async delete(id: string): Promise<boolean> {
    return (await collection()).delete(id);
  },
};

function collectPageIds(items: MenuItem[], into = new Set<string>()): Set<string> {
  for (const item of items) {
    if (item.target === "page" && item.pageId) into.add(item.pageId);
    collectPageIds(item.children, into);
  }
  return into;
}

function resolveItems(
  items: MenuItem[],
  pagesById: Map<string, CmsPage>,
): ResolvedMenuItem[] {
  const resolved: ResolvedMenuItem[] = [];

  for (const item of items) {
    if (!item.visible) continue;

    let href: string | null = null;

    switch (item.target) {
      case "page": {
        const page = item.pageId ? pagesById.get(item.pageId) : undefined;
        // Drop links to pages that were deleted or are not public — including
        // archived pages and scheduled ones whose time has not come yet.
        if (!page || !isPubliclyVisible(page)) continue;
        href = page.slug;
        break;
      }
      case "custom":
        if (!item.url) continue;
        href = item.url;
        break;
      case "entity":
        // TODO(phase-2): resolve tours/destinations once those models ship.
        // Until then an entity item renders as a label, never a broken link.
        href = null;
        break;
      case "heading":
        href = null;
        break;
    }

    resolved.push({
      id: item.id,
      label: item.label,
      href,
      openInNewTab: item.openInNewTab,
      children: resolveItems(item.children, pagesById),
    });
  }

  return resolved;
}
