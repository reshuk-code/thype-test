import Link from "next/link";

import { SearchField } from "@/components/frontend/thype/search-field";
import { blogIndexPath, destinationsIndexPath } from "@/config/site-paths";

/**
 * The public 404, inside the site layout so a mistyped address still has the
 * header, navigation and a way onward.
 */
export const metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-24 text-center sm:px-6 sm:py-32">
      <p className="font-label text-sm font-bold uppercase tracking-[0.2em] text-bronze-strong">404</p>
      <h1 className="mt-4 font-serif text-[2rem] font-bold text-ink sm:text-[2.5rem]">
        We cannot find that page
      </h1>
      <p className="mx-auto mt-4 max-w-prose text-body">
        The link may be out of date, or the story may have moved. Try a search, or start from one of these.
      </p>

      <SearchField id="not-found-search" className="mx-auto mt-8 max-w-md text-left" />

      <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
        {[
          { href: "/", label: "Home" },
          { href: blogIndexPath, label: "All stories" },
          { href: destinationsIndexPath, label: "Destinations" },
        ].map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="font-label text-sm font-bold uppercase text-ink transition-colors hover:text-bronze-strong"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
