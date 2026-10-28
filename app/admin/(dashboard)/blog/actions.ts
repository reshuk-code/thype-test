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
import { isPubliclyVisible } from "@/lib/cms/repositories/base";
import { posts } from "@/lib/cms/repositories/posts";
import { redirects } from "@/lib/cms/repositories/redirects";
import { users } from "@/lib/cms/repositories/users";
import { BLOG_BASE_PATH } from "@/config/site-paths";
import { RICH_TEXT_BLOCK } from "@/lib/cms/blocks";
import { postInputWithRulesSchema } from "@/schemas/post";
import type { ContentStatus } from "@/types/common";

/**
 * Blog server actions.
 *
 * Same shape as the page actions, including the separate publish permission,
 * so an Author can write posts but not push them live.
 */

function parseFormData(formData: FormData) {
  const content = formString(formData.get("content"));
  const blockId = formString(formData.get("blockId")) || crypto.randomUUID();

  return {
    title: formString(formData.get("title")),
    slug: formString(formData.get("slug")) || formString(formData.get("title")),
    excerpt: formString(formData.get("excerpt")),
    content,
    // As with pages, the body is one rich-text block until the Phase 3 block
    // editor lands. The stored shape does not change when it does.
    body: content.trim()
      ? [{ id: blockId, type: RICH_TEXT_BLOCK, props: { content } }]
      : [],
    featuredImage: formString(formData.get("featuredImage")),
    featuredImageAlt: formString(formData.get("featuredImageAlt")),
    featuredImageCaption: formString(formData.get("featuredImageCaption")),
    featuredImageCredit: formString(formData.get("featuredImageCredit")),
    authorId: formString(formData.get("authorId")) || null,
    authorProfileId: formString(formData.get("authorProfileId")) || null,
    category: formString(formData.get("category")),
    tags: formString(formData.get("tags")),
    destinationIds: formData.getAll("destinationIds").map(String),
    relatedPostIds: formData.getAll("relatedPostIds").map(String),
    featured: formBoolean(formData.get("featured")),
    showToc: formBoolean(formData.get("showToc")),
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

export async function savePostAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = formString(formData.get("id"));
  const isNew = !id;

  let createdId: string | null = null;

  try {
    const session = await requirePermission(isNew ? "blog.create" : "blog.update");

    const parsed = postInputWithRulesSchema.safeParse(parseFormData(formData));
    if (!parsed.success) return toActionState(parsed.error);

    if (parsed.data.status === "published" || parsed.data.status === "scheduled") {
      await requirePermission("blog.publish");
    }

    // The byline is captured at write time so it survives the profile or
    // account being deleted, the way the activity log captures entity titles.
    // A public author profile wins; the account name is the fallback for
    // posts written before profiles existed.
    const authorId = parsed.data.authorId ?? session.userId;
    const profile = parsed.data.authorProfileId
      ? await authors.get(parsed.data.authorProfileId)
      : null;
    const account =
      profile || authorId === session.userId ? null : await users.get(authorId);
    const authorName =
      profile?.name ??
      account?.name ??
      (authorId === session.userId ? session.name : null);

    const before = isNew ? null : await posts.get(id);

    const post = isNew
      ? await posts.create(
          { ...parsed.data, authorId },
          { userId: session.userId, authorName },
        )
      : await posts.update(
          id,
          { ...parsed.data, authorId },
          { userId: session.userId, authorName },
        );

    // A slug change on a post that has been public breaks every link already
    // shared. Only this layer knows posts live under BLOG_BASE_PATH, so the
    // redirect is recorded here rather than in the repository.
    if (before && before.slug !== post.slug && isPubliclyVisible(before)) {
      await redirects.recordMove(
        `${BLOG_BASE_PATH}/${before.slug}`,
        `${BLOG_BASE_PATH}/${post.slug}`,
      );
      revalidatePath("/admin/redirects");
    }

    await activity.record({
      action: isNew ? "created" : "updated",
      entityType: "posts",
      entityId: post.id,
      entityTitle: post.title,
      userId: session.userId,
      userName: session.name,
    });

    revalidatePath("/admin/blog");
    revalidatePath("/", "layout");

    if (isNew) createdId = post.id;
  } catch (error) {
    return toActionState(error);
  }

  if (createdId) redirect(`/admin/blog/${createdId}`);

  return actionSuccess("Post saved.");
}

export async function setPostStatusAction(
  id: string,
  status: ContentStatus,
): Promise<ActionState> {
  try {
    const session = await requirePermission(
      status === "trash" ? "blog.delete" : "blog.publish",
    );

    const post = await posts.setStatus(id, status, { userId: session.userId });

    await activity.record({
      action:
        status === "published"
          ? "published"
          : status === "trash"
            ? "trashed"
            : "unpublished",
      entityType: "posts",
      entityId: post.id,
      entityTitle: post.title,
      userId: session.userId,
      userName: session.name,
    });

    revalidatePath("/admin/blog");
    revalidatePath("/", "layout");
    return actionSuccess("Post updated.");
  } catch (error) {
    return toActionState(error);
  }
}

export async function deletePostAction(id: string): Promise<ActionState> {
  try {
    const session = await requirePermission("blog.delete");

    const post = await posts.get(id);
    if (!post) return actionError("That post no longer exists.");

    await posts.delete(id);

    await activity.record({
      action: "deleted",
      entityType: "posts",
      entityId: id,
      entityTitle: post.title,
      userId: session.userId,
      userName: session.name,
    });

    revalidatePath("/admin/blog");
    revalidatePath("/", "layout");
    return actionSuccess("Post deleted.");
  } catch (error) {
    return toActionState(error);
  }
}

export async function duplicatePostAction(id: string): Promise<ActionState> {
  try {
    const session = await requirePermission("blog.create");
    const copy = await posts.duplicate(id, { userId: session.userId });

    await activity.record({
      action: "duplicated",
      entityType: "posts",
      entityId: copy.id,
      entityTitle: copy.title,
      userId: session.userId,
      userName: session.name,
    });

    revalidatePath("/admin/blog");
    return actionSuccess("Post duplicated.", { id: copy.id });
  } catch (error) {
    return toActionState(error);
  }
}
