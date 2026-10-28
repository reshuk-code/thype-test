"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Input, Select } from "@/components/ui/field";
import { CONTENT_STATUSES } from "@/types/common";

const STATUS_LABELS: Record<string, string> = {
  any: "All statuses",
  published: "Published",
  draft: "Draft",
  scheduled: "Scheduled",
  archived: "Archived",
  trash: "Trash",
};

/**
 * Search, status, category and tag filters for the blog list.
 *
 * `ListToolbar` covers the first two; the taxonomy filters are blog-specific,
 * and one bar reads better than two stacked ones.
 */
export function BlogFilters({
  categories,
  tags,
  authors,
}: {
  categories: string[];
  tags: { name: string; count: number }[];
  authors: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (search) params.set("search", search);
      else params.delete("search");
      params.delete("page");
      router.replace(`${pathname}?${params.toString()}`);
    }, 300);

    return () => clearTimeout(timer);
    // `searchParams` is excluded deliberately — see the note in ListToolbar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, pathname, router]);

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "any") params.set(key, value);
    else params.delete(key);
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
      <div className="relative min-w-56 flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search posts by title, slug or excerpt…"
          className="pl-8"
          aria-label="Search posts"
        />
      </div>

      <Select
        value={searchParams.get("status") ?? "any"}
        onChange={(event) => setParam("status", event.target.value)}
        aria-label="Filter by status"
        className="w-36"
      >
        {["any", ...CONTENT_STATUSES].map((status) => (
          <option key={status} value={status}>
            {STATUS_LABELS[status]}
          </option>
        ))}
      </Select>

      <Select
        value={searchParams.get("category") ?? ""}
        onChange={(event) => setParam("category", event.target.value)}
        aria-label="Filter by category"
        className="w-40"
      >
        <option value="">All categories</option>
        {categories.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </Select>

      <Select
        value={searchParams.get("tag") ?? ""}
        onChange={(event) => setParam("tag", event.target.value)}
        aria-label="Filter by tag"
        className="w-40"
      >
        <option value="">All tags</option>
        {tags.map((tag) => (
          <option key={tag.name} value={tag.name}>
            {tag.name} ({tag.count})
          </option>
        ))}
      </Select>

      {authors.length > 0 ? (
        <Select
          value={searchParams.get("author") ?? ""}
          onChange={(event) => setParam("author", event.target.value)}
          aria-label="Filter by author"
          className="w-40"
        >
          <option value="">All authors</option>
          {authors.map((author) => (
            <option key={author.id} value={author.id}>
              {author.name}
            </option>
          ))}
        </Select>
      ) : null}

      <Select
        value={searchParams.get("featured") ?? ""}
        onChange={(event) => setParam("featured", event.target.value)}
        aria-label="Filter by featured"
        className="w-36"
      >
        <option value="">Any post</option>
        <option value="yes">Featured</option>
        <option value="no">Not featured</option>
      </Select>

      <Select
        value={searchParams.get("sort") ?? "updatedAt"}
        onChange={(event) => setParam("sort", event.target.value)}
        aria-label="Sort by"
        className="w-44"
      >
        <option value="updatedAt">Recently updated</option>
        <option value="publishedAt">Publication date</option>
        <option value="createdAt">Recently created</option>
      </Select>
    </div>
  );
}
