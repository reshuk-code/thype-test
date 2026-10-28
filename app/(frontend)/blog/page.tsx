import type { Metadata } from "next";

import { ListingPage } from "@/components/frontend/thype/listing-page";
import { BLOG_BASE_PATH, blogIndexPath } from "@/config/site-paths";
import { listingMetadata, managedListingPage } from "@/lib/seo/listing";
import { publicListParamsSchema } from "@/schemas/post";

/**
 * Every published story, newest first.
 *
 * Title, intro and SEO are editable through a CMS page with the slug "/blog"
 * (declared `cmsMetadata: true` in config/routes.ts); without one, neutral
 * defaults apply.
 */
export const revalidate = 300;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

async function params(searchParams: Props["searchParams"]) {
  return publicListParamsSchema.parse(await searchParams);
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const [{ page }, managed] = await Promise.all([
    params(searchParams),
    managedListingPage(BLOG_BASE_PATH),
  ]);
  return listingMetadata({ title: "Stories", path: BLOG_BASE_PATH, page, managed });
}

export default async function BlogIndexPage({ searchParams }: Props) {
  const [{ page }, managed] = await Promise.all([
    params(searchParams),
    managedListingPage(BLOG_BASE_PATH),
  ]);

  return (
    <ListingPage
      title={managed?.title ?? "Stories"}
      intro={managed?.excerpt}
      crumbs={[{ label: "Home", href: "/" }, { label: "Blog" }]}
      query={{}}
      basePath={blogIndexPath}
      page={page}
      empty="No stories have been published yet."
    />
  );
}
