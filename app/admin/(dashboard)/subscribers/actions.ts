"use server";

import { revalidatePath } from "next/cache";

import { actionSuccess, toActionState, type ActionState } from "@/lib/actions/result";
import { requirePermission } from "@/lib/auth";
import { activity } from "@/lib/cms/repositories/activity";
import { subscribers } from "@/lib/cms/repositories/subscribers";
import { idSchema } from "@/schemas/common";

/**
 * Removing an address — the answer to "please take me off your list" until a
 * provider with its own unsubscribe link takes over.
 */
export async function deleteSubscriberAction(id: string): Promise<ActionState> {
  try {
    const session = await requirePermission("enquiries.delete");
    const parsedId = idSchema.parse(id);

    await subscribers.delete(parsedId);

    await activity.record({
      action: "deleted",
      entityType: "subscribers",
      entityId: parsedId,
      // The address itself is personal data; the log does not need it.
      entityTitle: "Newsletter subscriber",
      userId: session.userId,
      userName: session.name,
    });

    revalidatePath("/admin/subscribers");
    return actionSuccess("Subscriber removed.");
  } catch (error) {
    return toActionState(error);
  }
}
