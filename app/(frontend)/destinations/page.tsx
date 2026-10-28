import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "@/components/frontend/thype/breadcrumbs";
import { CoverImage } from "@/components/frontend/thype/cover-image";
import { DESTINATIONS_BASE_PATH, destinationPath } from "@/config/site-paths";
import { cms } from "@/lib/cms";
import { pickImage } from "@/lib/images";
import { listingMetadata, managedListingPage } from "@/lib/seo/listing";

/**
 * Every published destination, grouped by country, with how many stories
 * each has. Title and intro come from a CMS page at "/destinations" when an
 * editor creates one.
 */
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const managed = await managedListingPage(DESTINATIONS_BASE_PATH);
  return listingMetadata({
    title: "Destinations",
    path: DESTINATIONS_BASE_PATH,
    description: "Places we have written about, and the stories from each.",
    page: 1,
    managed,
  });
}

export default async function DestinationsPage() {
  const [site, managed, destinations, counts] = await Promise.all([
    cms.settings.get(),
    managedListingPage(DESTINATIONS_BASE_PATH),
    cms.destinations.getPublished(),
    cms.posts.countByDestination(),
  ]);

  // Group by country, keeping the editor's display order inside each group.
  const groups = new Map<string, typeof destinations>();
  for (const destination of destinations) {
    const key = destination.country ?? "";
    groups.set(key, [...(groups.get(key) ?? []), destination]);
  }
  const ordered = [...groups.entries()].sort(([a], [b]) =>
    a === "" ? 1 : b === "" ? -1 : a.localeCompare(b),
  );

  return (
    <div className="mx-auto w-full max-w-[71.75rem] px-4 pb-16 pt-8 sm:px-6 xl:px-0">
      <Breadcrumbs
        items={[{ label: "Home", href: "/" }, { label: "Destinations" }]}
        siteUrl={site.siteUrl}
      />

      <header className="mt-8 max-w-3xl">
        <h1 className="font-serif text-[2rem] font-bold leading-tight text-ink sm:text-[2.5rem]">
          {managed?.title ?? "Destinations"}
        </h1>
        {managed?.excerpt ? (
          <p className="mt-4 text-lg leading-relaxed text-body">{managed.excerpt}</p>
        ) : null}
      </header>

      {destinations.length === 0 ? (
        <p className="mt-12 border border-dashed border-line px-6 py-16 text-center">
          No destinations have been published yet.
        </p>
      ) : (
        ordered.map(([country, places]) => (
          <section key={country || "other"} className="mt-14" aria-label={country || "Other places"}>
            {groups.size > 1 ? (
              <h2 className="border-b border-line pb-3 font-label text-[0.9375rem] font-bold uppercase text-ink">
                {country || "Other places"}
              </h2>
            ) : null}
            <ul className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-[1.8rem]">
              {places.map((place) => {
                const stories = counts.get(place.id) ?? 0;
                return (
                  <li key={place.id}>
                    <Link href={destinationPath(place.slug)} className="group relative block overflow-hidden">
                      <CoverImage
                        src={pickImage(place, "normal")}
                        alt=""
                        sizes="(min-width: 1024px) 257px, 50vw"
                        ratio="257 / 224"
                        imageClassName="transition-transform duration-700 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                      />
                      <span aria-hidden className="pointer-events-none absolute inset-2.5 border border-white/80" />
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0"
                      />
                      <span className="absolute bottom-5 left-7 right-5 text-white">
                        <span className="block font-serif text-[1.375rem] font-bold leading-tight">
                          {place.name}
                        </span>
                        <span className="mt-1 block text-sm text-white/90">
                          {stories === 1 ? "1 story" : `${stories} stories`}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
