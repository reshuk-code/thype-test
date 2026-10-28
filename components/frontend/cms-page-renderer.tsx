import { BLOCK_COMPONENTS } from "@/components/frontend/blocks";
import { parseBlockProps } from "@/lib/cms/blocks";
import type { CmsPage } from "@/types/page";

/**
 * Default renderer for a CMS page.
 *
 * This is a *starting point*, not a requirement. A project is free to delete
 * this component and render `page.body` however it likes, or to hand-write a
 * route for any page it wants full control over (§20).
 *
 * Two ways a block can fail to render, both silent by design:
 *
 * - **No component registered.** A page that used a block the code no longer
 *   ships still loads; the block is skipped and its props stay on the record,
 *   so re-adding the block brings the content back.
 * - **Props fail their schema.** Same outcome. A malformed block is a bad
 *   section, not a 500 on a customer-facing page.
 *
 * The page header is only rendered when the body does not open with a hero,
 * since a hero carries its own heading and two stacked titles look like a bug.
 */
export function CmsPageRenderer({ page }: { page: CmsPage }) {
  const opensWithHero = page.body[0]?.type === "hero";

  return (
    <article>
      {opensWithHero ? null : (
        <header className="mx-auto w-full max-w-3xl px-4 pt-14 sm:px-6">
          <h1 className="font-serif text-[2rem] font-bold leading-tight text-ink sm:text-[2.5rem]">
            {page.title}
          </h1>
          {page.excerpt ? (
            <p className="mt-4 text-lg leading-relaxed text-body">{page.excerpt}</p>
          ) : null}

          {page.featuredImage ? (
            // A plain <img>: the image URL comes from the CMS and may point at
            // any storage adapter, so next/image would need per-project
            // remotePatterns.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={page.featuredImage}
              alt=""
              className="mt-8 w-full object-cover"
            />
          ) : null}
        </header>
      )}

      {page.body.map((block) => {
        const Component = BLOCK_COMPONENTS[block.type];
        if (!Component) return null;

        const props = parseBlockProps(block);
        if (!props) return null;

        return <Component key={block.id} {...props} />;
      })}
    </article>
  );
}
