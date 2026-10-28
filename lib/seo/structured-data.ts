/**
 * JSON-LD builders for the public site.
 *
 * Pure functions returning plain objects; `<JsonLd>` serialises them. Every
 * URL is made absolute against the site origin, because structured data with
 * relative URLs is ignored by search engines.
 */

type JsonLdObject = Record<string, unknown>;

export function absoluteUrl(path: string | null | undefined, siteUrl: string): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  const origin = siteUrl.replace(/\/+$/, "");
  return `${origin}${path.startsWith("/") ? "" : "/"}${path}`;
}

export function breadcrumbJsonLd(
  items: { label: string; href?: string }[],
  siteUrl: string,
): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      ...(item.href ? { item: absoluteUrl(item.href, siteUrl) } : {}),
    })),
  };
}

export function websiteJsonLd(input: {
  siteName: string;
  siteUrl: string;
  logo: string | null;
  description: string | null;
  sameAs: string[];
  searchPath: string;
}): JsonLdObject[] {
  const origin = input.siteUrl.replace(/\/+$/, "");
  const organization: JsonLdObject = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${origin}/#organization`,
    name: input.siteName,
    url: `${origin}/`,
    ...(input.logo ? { logo: absoluteUrl(input.logo, origin) } : {}),
    ...(input.sameAs.length ? { sameAs: input.sameAs } : {}),
  };

  const website: JsonLdObject = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${origin}/#website`,
    name: input.siteName,
    url: `${origin}/`,
    ...(input.description ? { description: input.description } : {}),
    publisher: { "@id": `${origin}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${origin}${input.searchPath}?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return [organization, website];
}

export function blogPostingJsonLd(input: {
  url: string;
  headline: string;
  description: string | null;
  image: string | null;
  datePublished: string | null;
  dateModified: string;
  authorName: string | null;
  authorUrl?: string | null;
  section: string | null;
  keywords: string[];
  wordCount?: number;
  siteName: string;
  siteUrl: string;
}): JsonLdObject {
  const origin = input.siteUrl.replace(/\/+$/, "");
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    mainEntityOfPage: { "@type": "WebPage", "@id": absoluteUrl(input.url, origin) },
    headline: input.headline.slice(0, 110),
    ...(input.description ? { description: input.description } : {}),
    ...(input.image ? { image: [absoluteUrl(input.image, origin)] } : {}),
    ...(input.datePublished ? { datePublished: input.datePublished } : {}),
    dateModified: input.dateModified,
    ...(input.authorName
      ? {
          author: {
            "@type": "Person",
            name: input.authorName,
            ...(input.authorUrl ? { url: absoluteUrl(input.authorUrl, origin) } : {}),
          },
        }
      : {}),
    publisher: { "@id": `${origin}/#organization`, name: input.siteName },
    ...(input.section ? { articleSection: input.section } : {}),
    ...(input.keywords.length ? { keywords: input.keywords.join(", ") } : {}),
    ...(input.wordCount ? { wordCount: input.wordCount } : {}),
  };
}

/**
 * Serialises for a `<script type="application/ld+json">`.
 *
 * `JSON.stringify` alone is not enough inside HTML: a headline containing
 * `</script>` would close the tag. Escaping `<`, `>` and `&` as unicode keeps
 * the JSON identical to a parser and inert to the HTML tokenizer.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    // Line and paragraph separators end a line in older JavaScript parsers.
    .replaceAll(String.fromCharCode(0x2028), "\\u2028")
    .replaceAll(String.fromCharCode(0x2029), "\\u2029");
}
