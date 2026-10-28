import { Montserrat, Noto_Sans, Noto_Serif } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";

import { Lightbox } from "@/components/frontend/lightbox";
import { JsonLd } from "@/components/frontend/thype/json-ld";
import { MainNav } from "@/components/frontend/thype/main-nav";
import { NewsletterForm } from "@/components/frontend/thype/newsletter-form";
import { SearchField } from "@/components/frontend/thype/search-field";
import { SocialLinks, socialLinks } from "@/components/frontend/thype/social-links";
import { categoryPath, postPath, SEARCH_PATH } from "@/config/site-paths";
import { formatLongDate, formatPublicDate } from "@/lib/blog/format";
import { cms } from "@/lib/cms";
import { websiteJsonLd } from "@/lib/seo/structured-data";
import { cn } from "@/lib/utils";
import type { ResolvedMenuItem } from "@/types/navigation";
import type { SiteSettings } from "@/types/settings";

/*
 * Typefaces read from the design mockups: Noto Serif for headlines, Noto Sans
 * for text, Montserrat for navigation and labels. All three are SIL Open Font
 * Licence. `next/font` downloads them at build time and serves them from this
 * site, so no visitor request goes to Google.
 */
const serif = Noto_Serif({
  subsets: ["latin"],
  weight: ["700"],
  style: ["normal"],
  variable: "--font-thype-serif",
  display: "swap",
});
const sans = Noto_Sans({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--font-thype-sans",
  display: "swap",
});
const label = Montserrat({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-thype-label",
  display: "swap",
});

/**
 * Menus this layout reads, by key. Build them under Navigation in the admin:
 * - `main`: the nav band (Home, Travel Guides, Europe…)
 * - `utility`: the small links in the top bar (About, Affiliates, Contact)
 * - `footer`: the links in the bottom bar
 * A missing or empty menu simply renders nothing.
 */
const MENU_KEYS = { main: "main", utility: "utility", footer: "footer" } as const;

/** Before anyone builds a main menu, keep the site navigable. */
const FALLBACK_MAIN: ResolvedMenuItem[] = [
  { id: "home", label: "Home", href: "/", openInNewTab: false, children: [] },
  { id: "blog", label: "Stories", href: "/blog/", openInNewTab: false, children: [] },
  { id: "destinations", label: "Destinations", href: "/destinations/", openInNewTab: false, children: [] },
];

export default async function FrontendLayout({ children }: { children: ReactNode }) {
  const [site, main, utility, footerMenu, latest] = await Promise.all([
    cms.settings.get(),
    cms.navigation.get(MENU_KEYS.main),
    cms.navigation.get(MENU_KEYS.utility),
    cms.navigation.get(MENU_KEYS.footer),
    cms.posts.getPublishedPage({ perPage: 1 }),
  ]);

  const ticker = latest.items[0] ?? null;
  const sameAs = socialLinks(site).map(([, href]) => href);

  return (
    <div
      className={cn(
        serif.variable,
        sans.variable,
        label.variable,
        "thype flex min-h-dvh flex-col bg-white font-body text-body",
      )}
    >
      <a
        href="#main-content"
        className="sr-only z-50 bg-ink px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>

      <JsonLd
        data={websiteJsonLd({
          siteName: site.siteName,
          siteUrl: site.siteUrl,
          logo: site.logo,
          description: site.defaultSeo.description ?? (site.tagline || null),
          sameAs,
          searchPath: `${SEARCH_PATH}/`,
        })}
      />

      <header>
        {/* ------------------------------------------------------ top bar */}
        <div className="bg-night text-white">
          <div className="mx-auto flex h-[2.8rem] w-full max-w-[71.75rem] items-center justify-between gap-6 px-4 sm:px-6 xl:px-0">
            <div className="flex min-w-0 items-center gap-10">
              <p className="hidden font-label text-[0.6875rem] font-semibold uppercase md:block">
                {/* Rendered at build/revalidate time in UTC; see lib/blog/format.ts. */}
                {formatLongDate(new Date())}
              </p>
              {utility.length > 0 ? (
                // Below sm the search needs the room; these links repeat in the footer.
                <nav aria-label="Utility" className="hidden sm:block">
                  <ul className="flex gap-4">
                    {utility.map((item) =>
                      item.href ? (
                        <li key={item.id}>
                          <Link
                            href={item.href}
                            className="font-label text-[0.6875rem] font-semibold uppercase transition-colors hover:text-bronze"
                          >
                            {item.label}
                          </Link>
                        </li>
                      ) : null,
                    )}
                  </ul>
                </nav>
              ) : null}
            </div>
            <SearchField id="header-search" variant="dark" className="w-full max-w-56 sm:w-56" />
          </div>
        </div>

        {/* ------------------------------------------------- latest story */}
        {ticker ? (
          <div className="border-b border-line">
            <p className="mx-auto flex h-[3.25rem] w-full max-w-[71.75rem] items-center gap-4 overflow-hidden whitespace-nowrap px-4 sm:gap-9 sm:px-6 xl:px-0">
              <span className="shrink-0 font-body text-sm uppercase text-ink">Latest</span>
              <span className="flex min-w-0 items-center gap-3.5">
                {ticker.category ? (
                  <Link
                    href={categoryPath(ticker.category)}
                    className="hidden shrink-0 font-body text-sm uppercase text-bronze-strong hover:underline sm:inline"
                  >
                    {ticker.category}
                  </Link>
                ) : null}
                <time
                  dateTime={ticker.publishedAt ?? undefined}
                  className="hidden shrink-0 text-sm text-meta sm:inline"
                >
                  {formatPublicDate(ticker.publishedAt)}
                </time>
                <Link
                  href={postPath(ticker.slug)}
                  className="truncate font-serif text-base font-bold text-ink hover:text-bronze-strong"
                >
                  {ticker.title}
                </Link>
              </span>
            </p>
          </div>
        ) : null}

        {/* ------------------------------------------------ brand + promo */}
        <div className="mx-auto flex w-full max-w-[71.75rem] flex-col gap-5 px-4 py-6 sm:px-6 lg:flex-row lg:items-center lg:justify-between xl:px-0">
          <Brand site={site} />
          <Promo promo={site.header.promo} />
        </div>

        {/* --------------------------------------------------- nav band */}
        <div className={cn("bg-sage", site.header.sticky && "sticky top-0 z-30")}>
          <div className="relative mx-auto flex w-full max-w-[71.75rem] items-center justify-between px-4 sm:px-6 xl:px-0">
            <MainNav items={main.length > 0 ? main : FALLBACK_MAIN} />
            <SocialLinks site={site} className="-mr-2 gap-1" />
          </div>
        </div>
      </header>

      <main id="main-content" className="flex-1">
        {children}
      </main>

      <footer>
        {site.footer.newsletter.enabled && site.footer.newsletter.heading ? (
          <section aria-labelledby="newsletter-heading" className="bg-sage">
            <div className="mx-auto w-full max-w-[71.75rem] px-4 py-16 text-center sm:px-6 xl:px-0">
              <h2
                id="newsletter-heading"
                className="font-serif text-[2rem] font-bold leading-tight text-ink sm:text-[2.875rem]"
              >
                {site.footer.newsletter.heading}
              </h2>
              {site.footer.newsletter.text ? (
                <p className="mt-3 text-lg text-body">{site.footer.newsletter.text}</p>
              ) : null}
              <div className="mt-5">
                <NewsletterForm />
              </div>
              <SocialLinks
                site={site}
                className="mt-6 justify-center gap-8"
                iconClassName="text-meta"
              />
            </div>
          </section>
        ) : null}

        <div className="bg-night text-white/80">
          <div className="mx-auto flex w-full max-w-[71.75rem] flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 xl:px-0">
            <div>
              <p className="text-base">{copyrightLine(site.footer.copyright, site.siteName)}</p>
              {site.footer.legalNote ? (
                <p className="mt-1 text-xs text-white/70">{site.footer.legalNote}</p>
              ) : null}
            </div>
            {footerMenu.length > 0 ? (
              <nav aria-label="Footer">
                <ul className="flex flex-wrap gap-x-6 gap-y-2">
                  {footerMenu.map((item) =>
                    item.href ? (
                      <li key={item.id}>
                        <Link href={item.href} className="text-base transition-colors hover:text-white">
                          {item.label}
                        </Link>
                      </li>
                    ) : null,
                  )}
                </ul>
              </nav>
            ) : null}
          </div>
        </div>
      </footer>

      <Lightbox />
    </div>
  );
}

/**
 * The logo from Site settings, or the site name set as a wordmark until one
 * is uploaded. The tagline comes from Site settings too; the mockup's "News &
 * magazine theme" is placeholder copy, so nothing is hardcoded.
 */
function Brand({ site }: { site: SiteSettings }) {
  return (
    <Link href="/" className="flex items-center gap-4">
      {site.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={site.logo} alt={site.siteName} className="h-10 w-auto" />
      ) : (
        <span className="font-serif text-[2.4rem] font-bold italic leading-none tracking-tight text-logo">
          {site.siteName.toLowerCase()}.
        </span>
      )}
      {site.tagline ? (
        <span className="hidden font-label text-[0.6875rem] font-semibold uppercase tracking-[0.25em] text-meta sm:block">
          {site.tagline}
        </span>
      ) : null}
    </Link>
  );
}

function Promo({ promo }: { promo: SiteSettings["header"]["promo"] }) {
  if (!promo.image) return null;

  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={promo.image}
      alt={promo.alt ?? ""}
      width={734}
      height={91}
      className="h-auto w-full max-w-[45.875rem]"
    />
  );

  return promo.href ? (
    <a
      href={promo.href}
      target={/^https?:/i.test(promo.href) ? "_blank" : undefined}
      rel={/^https?:/i.test(promo.href) ? "noreferrer sponsored" : undefined}
      className="block lg:w-[45.875rem]"
    >
      {image}
    </a>
  ) : (
    <div className="lg:w-[45.875rem]">{image}</div>
  );
}

/** Expands the tokens the footer screen documents, with a sane default. */
function copyrightLine(template: string | null, siteName: string): string {
  const year = String(new Date().getFullYear());
  if (!template) return `© ${year} ${siteName}. All rights reserved.`;
  return template.replaceAll("{year}", year).replaceAll("{siteName}", siteName);
}
