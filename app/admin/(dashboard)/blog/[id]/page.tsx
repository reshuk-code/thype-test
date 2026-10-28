import { Eye } from "lucide-react";
import { notFound } from "next/navigation";

import { loadPostEditorOptions } from "@/app/admin/(dashboard)/blog/editor-options";
import { PageHeader } from "@/components/cms/page-header";
import { PostForm } from "@/components/cms/post-form";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { postPath } from "@/config/site-paths";
import { requirePermission } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { isPubliclyVisible } from "@/lib/cms/repositories/base";
import { posts } from "@/lib/cms/repositories/posts";
import { describeRecord } from "@/lib/record-meta";

export const metadata = { title: "Edit post" };

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePermission("blog.update");
  const { id } = await params;

  const [post, options] = await Promise.all([
    posts.get(id),
    loadPostEditorOptions(session.userId),
  ]);

  if (!post) notFound();

  const live = isPubliclyVisible(post);
  // Preview goes through the session-gated route, which switches on draft
  // mode; a live post can be linked to directly.
  const href = live
    ? postPath(post.slug)
    : `/api/cms/preview?slug=${encodeURIComponent(postPath(post.slug))}`;

  return (
    <>
      <PageHeader
        title={post.title}
        description={describeRecord(post)}
        breadcrumbs={[{ label: "Blog", href: "/admin/blog" }, { label: post.title }]}
        actions={
          <>
            <StatusBadge status={post.status} />
            {post.status !== "trash" ? (
              <Button asChild variant="outline" size="sm">
                <a href={href} target="_blank" rel="noreferrer">
                  <Eye className="size-4" />
                  {live ? "View" : "Preview"}
                </a>
              </Button>
            ) : null}
          </>
        }
      />

      <PostForm
        post={post}
        {...options}
        canPublish={hasPermission({ role: session.role }, "blog.publish")}
      />
    </>
  );
}
