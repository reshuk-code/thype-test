import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ListingPage } from "@/components/frontend/thype/listing-page";
import { blogIndexPath, CATEGORY_BASE_PATH, categoryPath } from "@/config/site-paths";
import { termSlug } from "@/lib/blog/taxonomy";
import { cms } from "@/lib/cms";
import { listingMetadata, managedListingPage } from "@/lib/seo/listing";
import { publicListParamsSchema } from "@/schemas/post";

/**
 * Stories in one category, e.g. /category/europe/.
 *
 * Categories are strings on posts, so the slug is resolved against the names
 * that have published stories. One with none is a 404: an empty section page
 * is a soft 404 to a search engine, and the name may be a draft's.
 */
export const revalidate = 300;

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function resolve({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const name = await cms.posts.categoryBySlug(slug);
  if (!name) return null;
  const path = `${CATEGORY_BASE_PATH}/${termSlug(name)}`;
  return {
    name,
    path,
    page: publicListParamsSchema.parse(query).page,
    managed: await managedListingPage(path),
  };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const found = await resolve(props);
  if (!found) return { title: "Not found", robots: { index: false } };

  return listingMetadata({
    title: found.name,
    path: found.path,
    description: `Stories filed under ${found.name}.`,
    page: found.page,
    managed: found.managed,
  });
}

export default async function CategoryPage(props: Props) {
  const found = await resolve(props);
  if (!found) notFound();

  return (
    <ListingPage
      eyebrow="Category"
      title={found.managed?.title ?? found.name}
      intro={found.managed?.excerpt}
      crumbs={[
        { label: "Home", href: "/" },
        { label: "Blog", href: blogIndexPath },
        { label: found.name },
      ]}
      query={{ category: found.name }}
      basePath={categoryPath(found.name)}
      page={found.page}
      activeCategory={found.name}
      empty="No stories here yet."
    />
  );
}
