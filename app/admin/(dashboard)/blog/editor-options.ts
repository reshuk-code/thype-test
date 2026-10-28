import "server-only";

import type { ReferenceOption } from "@/components/cms/reference-list-field";
import { authors } from "@/lib/cms/repositories/authors";
import { destinations } from "@/lib/cms/repositories/destinations";
import { posts } from "@/lib/cms/repositories/posts";
import { settings } from "@/lib/cms/repositories/settings";
import type { ContentStatus } from "@/types/common";

const STATUS_NOTE: Partial<Record<ContentStatus, string>> = {
  draft: "Draft",
  scheduled: "Scheduled",
  archived: "Archived",
};

/**
 * Everything the post editor offers in its pickers, loaded once for both the
 * new and the edit screen so the two cannot drift.
 */
export async function loadPostEditorOptions(userId: string) {
  const [authorList, destinationList, postList, categories, tags, siteUrl] =
    await Promise.all([
      authors.options(),
      destinations.options(),
      posts.options(),
      posts.categories(),
      posts.tags(),
      settings.siteUrl(),
    ]);

  const toOption = (id: string, label: string, status?: ContentStatus): ReferenceOption => ({
    id,
    label,
    note: status ? STATUS_NOTE[status] : undefined,
  });

  return {
    authorOptions: authorList.map(({ id, name }) => ({ id, name })),
    defaultAuthorProfileId: authorList.find((author) => author.userId === userId)?.id ?? null,
    destinationOptions: destinationList.map(({ id, name }) => toOption(id, name)),
    relatedOptions: postList.map(({ id, title, status }) => toOption(id, title, status)),
    categoryOptions: categories,
    tagOptions: tags.map((tag) => tag.name),
    siteUrl,
  };
}
