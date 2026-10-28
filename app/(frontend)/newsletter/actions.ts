"use server";

import {
  actionError,
  actionSuccess,
  formString,
  toActionState,
  type ActionState,
} from "@/lib/actions/result";
import { subscribers } from "@/lib/cms/repositories/subscribers";
import { allowSubmission } from "@/lib/rate-limit";
import { subscriberInputSchema } from "@/schemas/subscriber";

const THANKS = "Thanks for subscribing.";

/**
 * Public newsletter signup. The same documented exception as the contact
 * form: no `requirePermission()`, because the visitor is anonymous. The schema
 * accepts an address and a source tag and nothing else.
 *
 * Every success path answers identically, whether the address was new, was
 * already subscribed or tripped the honeypot, so the form reveals nothing.
 */
export async function subscribeAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    if (formString(formData.get("website")).trim() !== "") {
      return actionSuccess(THANKS);
    }

    if (!(await allowSubmission("newsletter", 5, 10 * 60_000))) {
      return actionError("Too many attempts. Please try again in a few minutes.");
    }

    const parsed = subscriberInputSchema.safeParse({
      email: formString(formData.get("email")),
      source: formString(formData.get("source")) || undefined,
    });
    if (!parsed.success) return toActionState(parsed.error);

    await subscribers.subscribe(parsed.data);
    return actionSuccess(THANKS);
  } catch (error) {
    console.error("[site] Newsletter signup failed:", error);
    return actionError("Sorry, that did not work. Please try again later.");
  }
}
