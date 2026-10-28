import { Search } from "lucide-react";

import { searchPath } from "@/config/site-paths";
import { cn } from "@/lib/utils";

/**
 * A plain GET form to the search page. Works without JavaScript, and the
 * query lands in the URL, so a search can be bookmarked or shared.
 */
export function SearchField({
  id,
  defaultValue = "",
  variant = "light",
  className,
}: {
  /** Unique per page: the label is tied to it. */
  id: string;
  defaultValue?: string;
  variant?: "light" | "dark";
  className?: string;
}) {
  const dark = variant === "dark";

  return (
    <form action={searchPath} method="get" role="search" className={cn("relative", className)}>
      <label htmlFor={id} className="sr-only">
        Search articles
      </label>
      <Search
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-1/2 size-[1.125rem] -translate-y-1/2",
          dark ? "left-0 text-white" : "left-5 text-meta",
        )}
      />
      <input
        id={id}
        name="q"
        type="search"
        defaultValue={defaultValue}
        maxLength={100}
        placeholder="Search articles here..."
        className={cn(
          "w-full font-body outline-none",
          dark
            ? "h-9 bg-transparent pl-8 text-xs uppercase tracking-wide text-white placeholder:text-white/85"
            : "h-[2.875rem] border border-line bg-sage pl-[3.25rem] pr-4 text-sm text-ink placeholder:text-meta focus:border-bronze",
        )}
      />
    </form>
  );
}
