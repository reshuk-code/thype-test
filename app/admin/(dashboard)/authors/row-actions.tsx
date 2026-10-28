"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Copy, MoreHorizontal, PencilLine, Send, Trash2, Undo2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import {
  deleteAuthorAction,
  duplicateAuthorAction,
  setAuthorStatusAction,
} from "@/app/admin/(dashboard)/authors/actions";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import type { ContentStatus } from "@/types/common";

const itemClass =
  "flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-muted";

/** Row actions for an author profile. Same menu as every content list. */
export function AuthorRowActions({
  author,
  canUpdate,
  canDelete,
  canPublish,
  canCreate,
}: {
  author: { id: string; name: string; status: ContentStatus };
  canUpdate: boolean;
  canDelete: boolean;
  canPublish: boolean;
  canCreate: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; message?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(result.message ?? "Done.");
      else toast.error(result.message ?? "That did not work.");
      router.refresh();
    });
  }

  function setStatus(status: ContentStatus) {
    run(() => setAuthorStatusAction(author.id, status));
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {canUpdate ? (
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/admin/authors/${author.id}`}>
            <PencilLine className="size-4" />
            <span className="sr-only">Edit {author.name}</span>
          </Link>
        </Button>
      ) : null}

      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button variant="ghost" size="sm" disabled={pending}>
            <MoreHorizontal className="size-4" />
            <span className="sr-only">More actions for {author.name}</span>
          </Button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={4}
            className="z-50 min-w-48 rounded-md border border-border bg-card p-1 shadow-lg"
          >
            {canPublish && author.status !== "published" ? (
              <DropdownMenu.Item className={itemClass} onSelect={() => setStatus("published")}>
                <Send className="size-4" />
                Publish
              </DropdownMenu.Item>
            ) : null}

            {canPublish && author.status === "published" ? (
              <DropdownMenu.Item className={itemClass} onSelect={() => setStatus("draft")}>
                <Undo2 className="size-4" />
                Switch to draft
              </DropdownMenu.Item>
            ) : null}

            {canDelete && author.status === "trash" ? (
              <DropdownMenu.Item className={itemClass} onSelect={() => setStatus("draft")}>
                <Undo2 className="size-4" />
                Restore from trash
              </DropdownMenu.Item>
            ) : null}

            {canCreate ? (
              <DropdownMenu.Item
                className={itemClass}
                onSelect={() => run(() => duplicateAuthorAction(author.id))}
              >
                <Copy className="size-4" />
                Duplicate
              </DropdownMenu.Item>
            ) : null}

            {canDelete && author.status !== "trash" ? (
              <DropdownMenu.Item
                className={`${itemClass} text-destructive`}
                onSelect={() => setStatus("trash")}
              >
                <Trash2 className="size-4" />
                Move to trash
              </DropdownMenu.Item>
            ) : null}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {canDelete && author.status === "trash" ? (
        <ConfirmButton
          variant="ghost"
          size="sm"
          title={`Delete "${author.name}"?`}
          description="This removes the profile permanently. Posts keep the byline name they were published under. This cannot be undone."
          confirmLabel="Delete permanently"
          successMessage="Author deleted."
          action={async () => {
            const result = await deleteAuthorAction(author.id);
            router.refresh();
            return result.ok ? undefined : { error: result.message };
          }}
        >
          <Trash2 className="size-4 text-destructive" />
          <span className="sr-only">Delete {author.name} permanently</span>
        </ConfirmButton>
      ) : null}
    </div>
  );
}
