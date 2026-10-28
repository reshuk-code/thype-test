"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Input, Select } from "@/components/ui/field";
import { CONTENT_STATUSES } from "@/types/common";
import { TOUR_DIFFICULTIES } from "@/types/content";

const STATUS_LABELS: Record<string, string> = {
  any: "All statuses",
  published: "Published",
  draft: "Draft",
  scheduled: "Scheduled",
  archived: "Archived",
  trash: "Trash",
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "Easy",
  moderate: "Moderate",
  challenging: "Challenging",
  strenuous: "Strenuous",
  extreme: "Extreme",
};

/** Search, status, destination, difficulty and featured filters. */
export function TourFilters({
  destinations,
}: {
  destinations: { id: string; name: string }[];
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
      <div className="relative min-w-52 flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search tours by name or slug…"
          className="pl-8"
          aria-label="Search tours"
        />
      </div>

      <Select
        value={searchParams.get("status") ?? "any"}
        onChange={(event) => setParam("status", event.target.value)}
        aria-label="Filter by status"
        className="w-32"
      >
        {["any", ...CONTENT_STATUSES].map((status) => (
          <option key={status} value={status}>
            {STATUS_LABELS[status]}
          </option>
        ))}
      </Select>

      <Select
        value={searchParams.get("destination") ?? ""}
        onChange={(event) => setParam("destination", event.target.value)}
        aria-label="Filter by destination"
        className="w-40"
      >
        <option value="">All destinations</option>
        {destinations.map((destination) => (
          <option key={destination.id} value={destination.id}>
            {destination.name}
          </option>
        ))}
      </Select>

      <Select
        value={searchParams.get("difficulty") ?? ""}
        onChange={(event) => setParam("difficulty", event.target.value)}
        aria-label="Filter by difficulty"
        className="w-36"
      >
        <option value="">Any difficulty</option>
        {TOUR_DIFFICULTIES.map((level) => (
          <option key={level} value={level}>
            {DIFFICULTY_LABELS[level]}
          </option>
        ))}
      </Select>

      <Select
        value={searchParams.get("featured") ?? ""}
        onChange={(event) => setParam("featured", event.target.value)}
        aria-label="Filter by featured"
        className="w-36"
      >
        <option value="">Featured or not</option>
        <option value="yes">Featured only</option>
        <option value="no">Not featured</option>
      </Select>
    </div>
  );
}
