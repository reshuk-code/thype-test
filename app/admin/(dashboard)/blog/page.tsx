import { BookOpen, PenLine, Star } from "lucide-react";
import Link from "next/link";

import { BlogFilters } from "@/app/admin/(dashboard)/blog/blog-filters";
import { PostRowActions } from "@/app/admin/(dashboard)/blog/row-actions";
import { PageHeader } from "@/components/cms/page-header";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import {
  EmptyState,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
} from "@/components/ui/table";
import { requirePermission } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { authors } from "@/lib/cms/repositories/authors";
import { posts } from "@/lib/cms/repositories/posts";
import { formatRelative } from "@/lib/utils";
import { listOptionsSchema } from "@/schemas/common";
import { postFiltersSchema } from "@/schemas/post";

export const metadata = { title: "Blog Posts" };

export default async function BlogListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission("blog.read");
  const params = await searchParams;

  const options = listOptionsSchema.parse({
    page: params.page,
    perPage: params.perPage,
    search: params.search,
    status: params.status,
    sort: params.sort,
    order: params.order,
  });

  const filters = postFiltersSchema.parse({
    category: params.category,
    tag: params.tag,
    author: params.author,
    featured: params.featured,
  });

  // Sort keys are allow-listed: the value reaches the adapter as a field name.
  const sort = ["updatedAt", "publishedAt", "createdAt"].includes(options.sort)
    ? options.sort
    : "updatedAt";

  const [result, categories, tags, authorOptions] = await Promise.all([
    posts.list({
      ...options,
      sort,
      category: filters.category,
      tag: filters.tag,
      authorProfileId: filters.author || undefined,
      featured: filters.featured === "" ? undefined : filters.featured === "yes",
    }),
    posts.categories(),
    posts.tags(),
    authors.options(),
  ]);

  const canCreate = hasPermission({ role: session.role }, "blog.create");
  const canUpdate = hasPermission({ role: session.role }, "blog.update");
  const canDelete = hasPermission({ role: session.role }, "blog.delete");
  const canPublish = hasPermission({ role: session.role }, "blog.publish");

  const filtered =
    Boolean(options.search) ||
    options.status !== "any" ||
    Boolean(filters.category) ||
    Boolean(filters.tag) ||
    Boolean(filters.author) ||
    filters.featured !== "";

  return (
    <>
      <PageHeader
        title="Blog Posts"
        description="Stories, with categories, tags, authors and destinations."
        actions={
          canCreate ? (
            <Button asChild size="sm">
              <Link href="/admin/blog/new">
                <PenLine className="size-4" />
                New post
              </Link>
            </Button>
          ) : null
        }
      />

      <Card>
        <BlogFilters categories={categories} tags={tags} authors={authorOptions} />

        {result.items.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="size-8" />}
            title={filtered ? "No posts match those filters" : "No posts yet"}
            description={
              filtered
                ? "Try a different search term, or clear the filters."
                : "Fetch published posts with cms.posts.getPublished() and render them however the site needs."
            }
            action={
              canCreate && !filtered ? (
                <Button asChild size="sm">
                  <Link href="/admin/blog/new">Write your first post</Link>
                </Button>
              ) : null
            }
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Title</TH>
                <TH className="hidden lg:table-cell">Author</TH>
                <TH className="hidden sm:table-cell">Category</TH>
                <TH className="hidden md:table-cell">Status</TH>
                <TH className="hidden lg:table-cell">Updated</TH>
                <TH className="text-right">Actions</TH>
              </tr>
            </THead>

            <TBody>
              {result.items.map((post) => (
                <TR key={post.id}>
                  <TD>
                    {canUpdate ? (
                      <Link
                        href={`/admin/blog/${post.id}`}
                        className="font-medium hover:text-primary"
                      >
                        {post.title}
                      </Link>
                    ) : (
                      <span className="font-medium">{post.title}</span>
                    )}
                    {post.featured ? (
                      <Star
                        className="ml-1.5 inline size-3.5 fill-current align-[-2px] text-amber-500"
                        aria-label="Featured"
                      />
                    ) : null}
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      <code>{post.slug}</code>
                      {post.readingMinutes
                        ? ` · ${post.readingMinutes} min read`
                        : ""}
                    </span>
                  </TD>

                  <TD className="hidden whitespace-nowrap text-xs text-muted-foreground lg:table-cell">
                    {post.authorName ?? "—"}
                  </TD>

                  <TD className="hidden sm:table-cell">
                    {post.category ? (
                      <Badge tone="neutral">{post.category}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TD>

                  <TD className="hidden md:table-cell">
                    <StatusBadge status={post.status} />
                  </TD>

                  <TD className="hidden whitespace-nowrap text-xs text-muted-foreground lg:table-cell">
                    {formatRelative(post.updatedAt)}
                  </TD>

                  <TD className="text-right">
                    <PostRowActions
                      post={{
                        id: post.id,
                        title: post.title,
                        status: post.status,
                      }}
                      canUpdate={canUpdate}
                      canDelete={canDelete}
                      canPublish={canPublish}
                      canCreate={canCreate}
                    />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}

        <Pagination
          result={result}
          basePath="/admin/blog"
          searchParams={{
            search: options.search || undefined,
            status: options.status === "any" ? undefined : options.status,
            category: filters.category || undefined,
            tag: filters.tag || undefined,
            author: filters.author || undefined,
            featured: filters.featured || undefined,
            sort: sort === "updatedAt" ? undefined : sort,
          }}
        />
      </Card>
    </>
  );
}
