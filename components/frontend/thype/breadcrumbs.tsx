import Link from "next/link";

import { JsonLd } from "@/components/frontend/thype/json-ld";
import { breadcrumbJsonLd } from "@/lib/seo/structured-data";

export interface Crumb {
  label: string;
  /** Site-relative. Omitted on the last crumb, the current page. */
  href?: string;
}

/**
 * Visible breadcrumbs and their BreadcrumbList structured data, from one
 * list, so what a reader sees and what a search engine reads cannot differ.
 */
export function Breadcrumbs({ items, siteUrl }: { items: Crumb[]; siteUrl: string }) {
  return (
    <>
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-x-3 gap-y-1 font-body text-[0.8125rem] text-ink">
          {items.map((item, index) => (
            <li key={`${item.label}-${index}`} className="flex items-center gap-3">
              {index > 0 ? (
                <span aria-hidden className="text-meta">
                  /
                </span>
              ) : null}
              {item.href && index < items.length - 1 ? (
                <Link href={item.href} className="transition-colors hover:text-bronze-strong">
                  {item.label}
                </Link>
              ) : (
                <span aria-current="page">{item.label}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <JsonLd data={breadcrumbJsonLd(items, siteUrl)} />
    </>
  );
}
