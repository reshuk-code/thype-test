"use server";

import {
  actionError,
  actionSuccess,
  formString,
  toActionState,
  type ActionState,
} from "@/lib/actions/result";
import { cms } from "@/lib/cms";
import { allowSubmission } from "@/lib/rate-limit";
import { enquiryInputSchema } from "@/schemas/enquiry";

/**
 * Public enquiry submission — a reference implementation.
 *
 * This is the developer's file, not the CMS's, and it is the one place in the
 * project where a Server Action runs for somebody who is not signed in. Two
 * consequences, both deliberate:
 *
 * - **No `requirePermission()`.** Every other mutation in this codebase starts
 *   with one; this is the documented exception, because the whole point is
 *   that an anonymous visitor can file an enquiry. What replaces it is the
 *   schema: `enquiryInputSchema` accepts the traveller's own fields and
 *   nothing else, so a crafted post cannot set `status` or `notes`. The
 *   repository sets those itself. See `lib/cms/repositories/enquiries.ts`.
 *
 * - **The reply address is never trusted as an identity.** It is a string
 *   somebody typed. Do not send anything to it that assumes otherwise.
 *
 * Rate limited per visitor (see `lib/rate-limit.ts` for what that does and
 * does not guarantee); the honeypot stops the crude bots before that.
 */
export async function submitEnquiryAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    // Honeypot: a field positioned off-screen and hidden from assistive tech,
    // which a person therefore never fills in. Bots fill every input they find.
    // Answering "thanks" rather than "rejected" denies them the feedback they
    // would need to tune around it.
    if (formString(formData.get("website")).trim() !== "") {
      return actionSuccess("Thanks — we will be in touch shortly.");
    }

    // Five messages in ten minutes is more than any person sends.
    if (!(await allowSubmission("contact", 5, 10 * 60_000))) {
      return actionError("That is a lot of messages in a short time. Please try again later.");
    }

    const parsed = enquiryInputSchema.safeParse({
      name: formString(formData.get("name")),
      email: formString(formData.get("email")),
      phone: formString(formData.get("phone")),
      country: formString(formData.get("country")),
      message: formString(formData.get("message")),
      subjectType: formString(formData.get("subjectType")),
      subjectId: formString(formData.get("subjectId")),
      travelDate: formString(formData.get("travelDate")),
      travellers: formString(formData.get("travellers")),
      source: "contact-form",
    });

    if (!parsed.success) return toActionState(parsed.error);

    await cms.enquiries.create(parsed.data);

    return actionSuccess("Thanks — we will be in touch shortly.");
  } catch (error) {
    // The visitor gets a generic message; the detail stays in the server log.
    console.error("[site] Enquiry submission failed:", error);
    return actionError(
      "Sorry — we could not send that just now. Please try again, or email us directly.",
    );
  }
}
