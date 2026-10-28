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
import { headerInputSchema, sidebarInputSchema } from "@/schemas/settings";

/**
 * Header chrome.
 *
 * Patches only the `header` and `sidebar` keys — the site settings screen owns
 * the rest, and two people editing different screens should not overwrite
 * each other.
 */
export async function saveHeaderAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requirePermission("settings.update");

    const parsed = headerInputSchema.safeParse({
      announcement: {
        enabled: formBoolean(formData.get("announcement.enabled")),
        text: formString(formData.get("announcement.text")),
        href: formString(formData.get("announcement.href")),
        linkLabel: formString(formData.get("announcement.linkLabel")),
      },
      sticky: formBoolean(formData.get("sticky")),
      showContact: formBoolean(formData.get("showContact")),
      cta: {
        label: formString(formData.get("cta.label")),
        href: formString(formData.get("cta.href")),
      },
      promo: {
        image: formString(formData.get("promo.image")),
        alt: formString(formData.get("promo.alt")),
        href: formString(formData.get("promo.href")),
      },
    });

    if (!parsed.success) return toActionState(parsed.error);

    const sidebar = sidebarInputSchema.safeParse({
      galleryHeading: formString(formData.get("sidebar.galleryHeading")),
      gallery: formData.getAll("sidebar.gallery").map(String),
      galleryHref: formString(formData.get("sidebar.galleryHref")),
    });

    if (!sidebar.success) return toActionState(sidebar.error);

    await settings.update({ header: parsed.data, sidebar: sidebar.data });

    revalidatePath("/admin/settings/header");
    // The header renders on every public page.
    revalidatePath("/", "layout");

    return actionSuccess("Header saved.");
  } catch (error) {
    return toActionState(error);
  }
}
