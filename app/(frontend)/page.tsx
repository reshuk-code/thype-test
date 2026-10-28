import type { Metadata } from "next";
import { draftMode } from "next/headers";

import { BLOCK_COMPONENTS } from "@/components/frontend/blocks";
import { PreviewBanner } from "@/components/frontend/preview-banner";
import { cms } from "@/lib/cms";
import { parseBlockProps } from "@/lib/cms/blocks";
import { generateCmsMetadata } from "@/lib/seo/metadata";
import type { BlockInstance } from "@/types/blocks";

/**
 * The Thype homepage.
 *
 * Its sections are the body of the CMS page with slug "/" (Pages → Home):
 * the editor adds, removes and reorders blocks there, and this route renders
 * them. Nothing here names an article; every block picks stories by rule
 * (featured, latest, a category) when the page renders.
 *
 * Until that page exists, or while its body is empty, a minimal default is
 * used (below), so a fresh install is not a blank page.
 */
export const revalidate = 300;

/**
 * Used until the Home page has blocks. Only the sections that need no input:
 * collection tiles need photos and links, a category strip needs a category,
 * so those wait for the editor.
 */
const DEFAULT_SECTIONS: BlockInstance[] = [
  { id: "default-strip", type: "story-strip", props: { source: "featured", limit: 4 } },
  { id: "default-feed", type: "story-feed", props: { perPage: 7, showSidebar: true } },
];

async function resolveHome() {
  const { isEnabled } = await draftMode();
  const page = isEnabled
    ? await cms.pages.getBySlugIncludingDrafts("/")
    : await cms.pages.getBySlug("/");
  return { page, previewing: isEnabled };
}

export async function generateMetadata(): Promise<Metadata> {
  const [{ page }, site] = await Promise.all([resolveHome(), cms.settings.get()]);

  const metadata = await generateCmsMetadata({
    title: site.siteName,
    path: "/",
    description: page?.excerpt ?? (site.tagline || null),
    image: page?.featuredImage ?? null,
    seo: page?.seo ?? null,
  });

  // The root layout's "%s · Site" template would print the name twice here.
  const title = page?.seo.title ?? (site.tagline ? `${site.siteName} · ${site.tagline}` : site.siteName);
  return { ...metadata, title: { absolute: title } };
}

export default async function HomePage() {
  const [{ page, previewing }, site] = await Promise.all([resolveHome(), cms.settings.get()]);
  const sections = page && page.body.length > 0 ? page.body : DEFAULT_SECTIONS;

  return (
    <>
      {previewing && page && page.status !== "published" ? (
        <PreviewBanner status={page.status} path="/" />
      ) : null}

      {/* One h1 per page. The masthead is a link, not a heading, so it lives here. */}
      <h1 className="sr-only">{page?.title && page.title !== "Home" ? page.title : site.siteName}</h1>

      {sections.map((block) => {
        const Component = BLOCK_COMPONENTS[block.type];
        if (!Component) return null;
        const props = parseBlockProps(block);
        if (!props) return null;
        return <Component key={block.id} {...props} />;
      })}
    </>
  );
}
