import type { TocEntry } from "@/lib/rich-text-anchors";
import { cn } from "@/lib/utils";

/**
 * "In this story": in-page links to the article's headings. Plain anchors,
 * no script; the ids come from the same helper the renderer uses.
 */
export function TableOfContents({ entries }: { entries: TocEntry[] }) {
  return (
    <nav aria-labelledby="toc-heading" className="border-l border-bronze bg-sage px-6 py-5">
      <h2 id="toc-heading" className="font-label text-[0.8125rem] font-bold uppercase tracking-[0.04em] text-ink">
        In this story
      </h2>
      <ol className="mt-3 space-y-2 text-[0.9375rem]">
        {entries.map((entry) => (
          <li key={entry.id} className={cn(entry.level === 3 && "pl-4")}>
            <a href={`#${entry.id}`} className="text-body underline-offset-4 hover:text-bronze-strong hover:underline">
              {entry.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
