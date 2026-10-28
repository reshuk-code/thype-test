import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";
import type { ContentStatus } from "@/types/common";
import type { EnquiryStatus } from "@/types/content";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      tone: {
        neutral: "border-border bg-muted text-muted-foreground",
        success:
          "border-transparent bg-[color-mix(in_oklch,var(--success)_18%,transparent)] text-[var(--success)]",
        warning:
          "border-transparent bg-[color-mix(in_oklch,var(--warning)_20%,transparent)] text-[color-mix(in_oklch,var(--warning)_75%,var(--foreground))]",
        danger:
          "border-transparent bg-[color-mix(in_oklch,var(--destructive)_15%,transparent)] text-destructive",
        info: "border-transparent bg-accent text-accent-foreground",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

const STATUS_TONE: Record<ContentStatus, VariantProps<typeof badgeVariants>["tone"]> = {
  published: "success",
  draft: "neutral",
  scheduled: "info",
  archived: "neutral",
  trash: "danger",
};

const STATUS_LABEL: Record<ContentStatus, string> = {
  published: "Published",
  draft: "Draft",
  scheduled: "Scheduled",
  archived: "Archived",
  trash: "Trash",
};

export function StatusBadge({ status }: { status: ContentStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

/**
 * Triage state of an enquiry. A separate scale from the publication statuses
 * above: "converted" is the good outcome here, and "spam" is the bad one,
 * neither of which the content lifecycle has a word for.
 */
const ENQUIRY_TONE: Record<
  EnquiryStatus,
  VariantProps<typeof badgeVariants>["tone"]
> = {
  new: "info",
  contacted: "neutral",
  quoted: "warning",
  converted: "success",
  closed: "neutral",
  spam: "danger",
};

const ENQUIRY_LABEL: Record<EnquiryStatus, string> = {
  new: "New",
  contacted: "Contacted",
  quoted: "Quoted",
  converted: "Converted",
  closed: "Closed",
  spam: "Spam",
};

export function EnquiryStatusBadge({ status }: { status: EnquiryStatus }) {
  return <Badge tone={ENQUIRY_TONE[status]}>{ENQUIRY_LABEL[status]}</Badge>;
}
