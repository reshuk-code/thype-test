import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ListingPage } from "@/components/frontend/thype/listing-page";
import { blogIndexPath, TAG_BASE_PATH, tagPath } from "@/config/site-paths";
import { termSlug } from "@/lib/blog/taxonomy";
import { cms } from "@/lib/cms";
import { listingMetadata, managedListingPage } from "@/lib/seo/listing";
import { publicListParamsSchema } from "@/schemas/post";

/**
 * Stories with one tag, e.g. /tag/street-food/.
 *
 * Indexable, because a tag page collects stories no other page does. If the
 * client uses tags loosely and these start to look thin, set noindex here.
 */
export const revalidate = 300;

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function resolve({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const name = await cms.posts.tagBySlug(slug);
  if (!name) return null;
  const path = `${TAG_BASE_PATH}/${termSlug(name)}`;
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
    title: `Tagged “${found.name}”`,
    path: found.path,
    description: `Stories tagged ${found.name}.`,
    page: found.page,
    managed: found.managed,
  });
}

export default async function TagPage(props: Props) {
  const found = await resolve(props);
  if (!found) notFound();

  return (
    <ListingPage
      eyebrow="Tag"
      title={found.managed?.title ?? found.name}
      intro={found.managed?.excerpt}
      crumbs={[
        { label: "Home", href: "/" },
        { label: "Blog", href: blogIndexPath },
        { label: found.name },
      ]}
      query={{ tag: found.name }}
      basePath={tagPath(found.name)}
      page={found.page}
      empty="No stories here yet."
    />
  );
}
