import { serializeJsonLd } from "@/lib/seo/structured-data";

/**
 * One JSON-LD script. The only `dangerouslySetInnerHTML` on the public site,
 * and safe because the input is our own object passed through
 * `serializeJsonLd`, which escapes everything that could end the script tag.
 */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
