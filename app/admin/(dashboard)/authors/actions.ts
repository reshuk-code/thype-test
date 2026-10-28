"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  actionError,
  actionSuccess,
  formBoolean,
  formString,
  toActionState,
  type ActionState,
} from "@/lib/actions/result";
import { requirePermission } from "@/lib/auth";
import { activity } from "@/lib/cms/repositories/activity";
import { authors } from "@/lib/cms/repositories/authors";
import { authorInputWithRulesSchema } from "@/schemas/author";
import type { ContentStatus } from "@/types/common";
import { AUTHOR_LINK_KEYS } from "@/types/content";

/**
 * Author profile server actions. Same shape as every other content module:
 * permission, parse, publish check, repository, activity, revalidate.
 */

function parseFormData(formData: FormData) {
  return {
    name: formString(formData.get("name")),
    slug: formString(formData.get("slug")) || formString(formData.get("name")),
    jobTitle: formString(formData.get("jobTitle")),
    bio: formString(formData.get("bio")),
    avatar: formString(formData.get("avatar")),
    links: Object.fromEntries(
      AUTHOR_LINK_KEYS.map((key) => [key, formString(formData.get(`links.${key}`))]),
    ),
    userId: formString(formData.get("userId")) || null,
    status: formString(formData.get("status")),
    publishedAt: formString(formData.get("publishedAt")) || null,
    seo: {
      title: formString(formData.get("seo.title")),
      description: formString(formData.get("seo.description")),
      canonical: formString(formData.get("seo.canonical")),
      robots: formString(formData.get("seo.robots")) || "index",
      noFollow: formBoolean(formData.get("seo.noFollow")),
      ogTitle: formString(formData.get("seo.ogTitle")),
      ogDescription: formString(formData.get("seo.ogDescription")),
      ogImage: formString(formData.get("seo.ogImage")),
      twitterCard:
        formString(formData.get("seo.twitterCard")) || "summary_large_image",
      structuredData: formString(formData.get("seo.structuredData")),
    },
  };
}

export async function saveAuthorAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = formString(formData.get("id"));
  const isNew = !id;

  let createdId: string | null = null;

  try {
    const session = await requirePermission(
      isNew ? "authors.create" : "authors.update",
    );

    const parsed = authorInputWithRulesSchema.safeParse(parseFormData(formData));
    if (!parsed.success) return toActionState(parsed.error);

    if (parsed.data.status === "published" || parsed.data.status === "scheduled") {
      await requirePermission("authors.publish");
    }

    // Linking a profile to an account says "this byline is that person". Only
    // someone who can see the user list may make or change that claim; an
    // unchanged link is carried through by editors who cannot.
    const previousUserId = isNew ? null : ((await authors.get(id))?.userId ?? null);
    if (parsed.data.userId !== previousUserId) await requirePermission("users.read");

    const record = isNew
      ? await authors.create(parsed.data, { userId: session.userId })
      : await authors.update(id, parsed.data, { userId: session.userId });

    await activity.record({
      action: isNew ? "created" : "updated",
      entityType: "authors",
      entityId: record.id,
      entityTitle: record.name,
      userId: session.userId,
      userName: session.name,
    });

    revalidatePath("/admin/authors");
    revalidatePath("/", "layout");

    if (isNew) createdId = record.id;
  } catch (error) {
    return toActionState(error);
  }

  if (createdId) redirect(`/admin/authors/${createdId}`);

  return actionSuccess("Author saved.");
}

export async function setAuthorStatusAction(
  id: string,
  status: ContentStatus,
): Promise<ActionState> {
  try {
    const session = await requirePermission(
      status === "trash" ? "authors.delete" : "authors.publish",
    );

    const record = await authors.setStatus(id, status, { userId: session.userId });

    await activity.record({
      action:
        status === "published"
          ? "published"
          : status === "trash"
            ? "trashed"
            : "unpublished",
      entityType: "authors",
      entityId: record.id,
      entityTitle: record.name,
      userId: session.userId,
      userName: session.name,
    });

    revalidatePath("/admin/authors");
    revalidatePath("/", "layout");
    return actionSuccess("Author updated.");
  } catch (error) {
    return toActionState(error);
  }
}

export async function deleteAuthorAction(id: string): Promise<ActionState> {
  try {
    const session = await requirePermission("authors.delete");

    const record = await authors.get(id);
    if (!record) return actionError("That author no longer exists.");

    await authors.delete(id);

    await activity.record({
      action: "deleted",
      entityType: "authors",
      entityId: id,
      entityTitle: record.name,
      userId: session.userId,
      userName: session.name,
    });

    revalidatePath("/admin/authors");
    revalidatePath("/", "layout");
    return actionSuccess("Author deleted.");
  } catch (error) {
    return toActionState(error);
  }
}

export async function duplicateAuthorAction(id: string): Promise<ActionState> {
  try {
    const session = await requirePermission("authors.create");
    const copy = await authors.duplicate(id, { userId: session.userId });

    await activity.record({
      action: "duplicated",
      entityType: "authors",
      entityId: copy.id,
      entityTitle: copy.name,
      userId: session.userId,
      userName: session.name,
    });

    revalidatePath("/admin/authors");
    return actionSuccess("Author duplicated.", { id: copy.id });
  } catch (error) {
    return toActionState(error);
  }
}
