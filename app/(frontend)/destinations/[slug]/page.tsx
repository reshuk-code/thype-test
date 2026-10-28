import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { notFound } from "next/navigation";

import { PreviewBanner } from "@/components/frontend/preview-banner";
import { RichListText, RichText } from "@/components/frontend/rich-text";
import { ListingPage } from "@/components/frontend/thype/listing-page";
import {
  DESTINATIONS_BASE_PATH,
  destinationPath,
  destinationsIndexPath,
} from "@/config/site-paths";
import { cms } from "@/lib/cms";
import { pickImage } from "@/lib/images";
import { isEmptyRichContent, isEmptyRichList } from "@/lib/rich-text";
import { listingMetadata } from "@/lib/seo/listing";
import { publicListParamsSchema } from "@/schemas/post";
import type { Destination } from "@/types/content";

/**
 * One destination as a travel guide: cover photo, the editor's guide text and
 * highlights, then every story filed under it.
 *
 * Honours draft mode, so the admin's Preview works. The agency fields on the
 * record (best season, duration, FAQs, coordinates) are not shown: Thype
 * writes about places rather than selling trips to them.
 */
export const revalidate = 300;

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function resolve({ params, searchParams }: Props) {
  const [{ slug }, query, draft] = await Promise.all([params, searchParams, draftMode()]);
  const destination: Destination | null = draft.isEnabled
    ? await cms.destinations.getBySlugIncludingDrafts(slug)
    : await cms.destinations.getBySlug(slug);
  return {
    destination,
    previewing: draft.isEnabled,
    page: publicListParamsSchema.parse(query).page,
  };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { destination, page, previewing } = await resolve(props);
  if (!destination) return { title: "Not found", robots: { index: false } };

  return listingMetadata({
    title: destination.name,
    path: `${DESTINATIONS_BASE_PATH}/${destination.slug}`,
    description: destination.shortDescription,
    image: pickImage(destination, "banner"),
    page,
    managed: null,
    noindex: previewing,
  }).then((metadata) =>
    // The record's own SEO block wins over the listing defaults on page 1.
    page === 1 && destination.seo.title ? { ...metadata, title: destination.seo.title } : metadata,
  );
}

export default async function DestinationPage(props: Props) {
  const { destination, previewing, page } = await resolve(props);
  if (!destination) notFound();

  const cover = pickImage(destination, "banner");
  const hasGuide = !isEmptyRichContent(destination.description);
  const hasHighlights = !isEmptyRichList(destination.highlights);

  return (
    <>
      {previewing && destination.status !== "published" ? (
        <PreviewBanner status={destination.status} path={destinationPath(destination.slug)} />
      ) : null}

      <ListingPage
        eyebrow={destination.country ?? "Destination"}
        title={destination.name}
        intro={destination.shortDescription}
        cover={cover ? { src: cover, alt: "" } : null}
        before={
          hasGuide || hasHighlights ? (
            <div className="grid gap-10 lg:grid-cols-[minmax(0,46rem)_22rem] lg:justify-between lg:gap-6">
              {hasGuide ? (
                <div className="thype-prose">
                  <RichText content={destination.description} />
                </div>
              ) : null}
              {hasHighlights ? (
                <aside aria-labelledby="highlights" className="bg-sage p-6">
                  <h2
                    id="highlights"
                    className="font-label text-[0.9375rem] font-bold uppercase text-ink"
                  >
                    Highlights
                  </h2>
                  <div className="thype-prose mt-4 text-base">
                    <RichListText content={destination.highlights} />
                  </div>
                </aside>
              ) : null}
            </div>
          ) : null
        }
        crumbs={[
          { label: "Home", href: "/" },
          { label: "Destinations", href: destinationsIndexPath },
          { label: destination.name },
        ]}
        query={{ destinationId: destination.id }}
        basePath={destinationPath(destination.slug)}
        page={page}
        empty={`No stories about ${destination.name} yet.`}
      />
    </>
  );
}
