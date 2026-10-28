"use server";

import { revalidatePath } from "next/cache";

import {
  actionSuccess,
  formBoolean,
  formString,
  toActionState,
  type ActionState,
} from "@/lib/actions/result";
import { requirePermission } from "@/lib/auth";
import { settings } from "@/lib/cms/repositories/settings";
import { footerInputSchema } from "@/schemas/settings";

/**
 * Footer chrome.
 *
 * Columns arrive as two parallel lists — every row posts both a heading and a
 * menu key, so index `n` of one belongs with index `n` of the other. Rows the
 * client left completely blank are dropped here rather than rejected: adding a
 * column and changing your mind should not be an error.
 */
export async function saveFooterAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requirePermission("settings.update");

    const headings = formData.getAll("column.heading").map(formString);
    const menuKeys = formData.getAll("column.menuKey").map(formString);

    const columns = headings
      .map((heading, index) => ({
        heading: heading.trim(),
        menuKey: (menuKeys[index] ?? "").trim(),
      }))
      .filter((column) => column.heading !== "" || column.menuKey !== "");

    const parsed = footerInputSchema.safeParse({
      blurb: formString(formData.get("blurb")),
      columns,
      showSocial: formBoolean(formData.get("showSocial")),
      showContact: formBoolean(formData.get("showContact")),
      copyright: formString(formData.get("copyright")),
      legalNote: formString(formData.get("legalNote")),
      newsletter: {
        enabled: formBoolean(formData.get("newsletter.enabled")),
        heading: formString(formData.get("newsletter.heading")),
        text: formString(formData.get("newsletter.text")),
      },
    });

    if (!parsed.success) return toActionState(parsed.error);

    await settings.update({ footer: parsed.data });

    revalidatePath("/admin/settings/footer");
    // The footer renders on every public page.
    revalidatePath("/", "layout");

    return actionSuccess("Footer saved.");
  } catch (error) {
    return toActionState(error);
  }
}
