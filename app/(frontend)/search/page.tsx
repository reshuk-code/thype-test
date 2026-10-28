import type { Metadata } from "next";

import { ListingPage } from "@/components/frontend/thype/listing-page";
import { SearchField } from "@/components/frontend/thype/search-field";
import { searchPath } from "@/config/site-paths";
import { publicListParamsSchema } from "@/schemas/post";

/**
 * Search results. Never indexed: every query string is a new URL with
 * content that already lives elsewhere, which is the textbook duplicate.
 * robots.txt disallows the path as well.
 *
 * Dynamic by nature, since the query is the input.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Search",
  robots: { index: false, follow: true },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function SearchPage({ searchParams }: Props) {
  const { q, page } = publicListParamsSchema.parse(await searchParams);

  if (!q) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-20 sm:px-6">
        <h1 className="font-serif text-[2rem] font-bold text-ink">Search</h1>
        <p className="mt-3 text-body">Search stories by title, summary, category or tag.</p>
        <SearchField id="search-page" className="mt-6" />
      </div>
    );
  }

  return (
    <ListingPage
      eyebrow="Search"
      title={`Results for “${q}”`}
      intro={<SearchField id="search-page" defaultValue={q} className="max-w-xl" />}
      crumbs={[{ label: "Home", href: "/" }, { label: "Search" }]}
      query={{ search: q }}
      basePath={`${searchPath}?q=${encodeURIComponent(q)}`}
      page={page}
      empty={
        <>
          Nothing matched “{q}”. Try a place, a category or a shorter phrase.
        </>
      }
    />
  );
}
