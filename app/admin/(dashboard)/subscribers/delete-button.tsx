"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { deleteSubscriberAction } from "@/app/admin/(dashboard)/subscribers/actions";
import { ConfirmButton } from "@/components/ui/confirm-button";

export function DeleteSubscriberButton({ id, email }: { id: string; email: string }) {
  const router = useRouter();

  return (
    <ConfirmButton
      variant="ghost"
      size="sm"
      title="Remove this subscriber?"
      description={`${email} will be left out of the next export. This cannot be undone.`}
      confirmLabel="Remove"
      successMessage="Subscriber removed."
      action={async () => {
        const result = await deleteSubscriberAction(id);
        router.refresh();
        return result.ok ? undefined : { error: result.message };
      }}
    >
      <Trash2 className="size-4 text-destructive" />
      <span className="sr-only">Remove {email}</span>
    </ConfirmButton>
  );
}
