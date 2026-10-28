import Link from "next/link";

import { CoverImage } from "@/components/frontend/thype/cover-image";
import { SearchField } from "@/components/frontend/thype/search-field";
import { categoryPath } from "@/config/site-paths";
import { cms } from "@/lib/cms";
import { cn } from "@/lib/utils";

function SidebarHeading({ children, ruled = false }: { children: string; ruled?: boolean }) {
  return (
    <h2
      className={cn(
        "font-label text-[0.9375rem] font-bold uppercase tracking-[0.02em] text-ink",
        ruled && "border-b border-line pb-4",
      )}
    >
      {children}
    </h2>
  );
}

/**
 * The sidebar beside the feed and articles: search, the photo grid from
 * Header settings, and the categories that have published stories.
 */
export async function Sidebar({ activeCategory }: { activeCategory?: string | null }) {
  const [site, categories] = await Promise.all([
    cms.settings.get(),
    cms.posts.publishedCategories(),
  ]);

  const { galleryHeading, gallery, galleryHref } = site.sidebar;
  const photos = gallery.slice(0, 6);

  return (
    <aside aria-label="Sidebar" className="space-y-14">
      <SearchField id="sidebar-search" />

      {galleryHeading && photos.length > 0 ? (
        <section>
          <SidebarHeading>{galleryHeading}</SidebarHeading>
          <ul className="mt-6 grid grid-cols-3 gap-2">
            {photos.map((url, index) => (
              <li key={`${url}-${index}`}>
                {galleryHref ? (
                  <a
                    href={galleryHref}
                    target="_blank"
                    rel="noreferrer"
                    className="block transition-opacity hover:opacity-85"
                  >
                    <CoverImage src={url} alt="" sizes="113px" ratio="1 / 1" />
                    <span className="sr-only">
                      {galleryHeading}, photo {index + 1} (opens in a new tab)
                    </span>
                  </a>
                ) : (
                  <CoverImage src={url} alt="" sizes="113px" ratio="1 / 1" />
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {categories.length > 0 ? (
        <nav aria-labelledby="sidebar-categories">
          <h2
            id="sidebar-categories"
            className="border-b border-line pb-4 font-label text-[0.9375rem] font-bold uppercase tracking-[0.02em] text-ink"
          >
            Categories
          </h2>
          <ul className="mt-5 space-y-4">
            {categories.map(({ name }) => {
              const active = name === activeCategory;
              return (
                <li key={name} className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className={cn("size-1.5 rounded-full", active ? "bg-bronze" : "bg-line")}
                  />
                  <Link
                    href={categoryPath(name)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "font-body text-[0.8125rem] uppercase transition-colors hover:text-bronze-strong",
                      active ? "text-bronze-strong" : "text-ink",
                    )}
                  >
                    {name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}
    </aside>
  );
}

export { SidebarHeading };
