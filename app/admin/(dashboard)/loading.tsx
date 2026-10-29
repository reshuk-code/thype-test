import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/*
 * One placeholder for every admin screen: the sidebar and header stay put
 * (they live in the layout), and only the content area is swapped. A heading
 * and a table covers the list screens, which are most of the admin.
 */

function Bone({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-muted motion-reduce:animate-none", className)} />;
}

export default function AdminLoading() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>

      <div className="mb-6 flex items-end justify-between gap-4">
        <div className="space-y-3">
          <Bone className="h-3 w-24" />
          <Bone className="h-7 w-48" />
          <Bone className="h-4 w-72 max-w-full" />
        </div>
        <Bone className="h-9 w-28" />
      </div>

      <Card className="overflow-hidden">
        <div className="flex gap-3 border-b border-border p-4">
          <Bone className="h-9 w-64 max-w-full" />
          <Bone className="h-9 w-32" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="flex items-center gap-4 px-4 py-3.5">
              <Bone className="size-10 shrink-0" />
              <div className="min-w-0 flex-1 space-y-2">
                <Bone className="h-4 w-1/2" />
                <Bone className="h-3 w-1/4" />
              </div>
              <Bone className="hidden h-5 w-20 sm:block" />
              <Bone className="hidden h-4 w-24 md:block" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
