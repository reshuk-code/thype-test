import { loadPostEditorOptions } from "@/app/admin/(dashboard)/blog/editor-options";
import { PageHeader } from "@/components/cms/page-header";
import { PostForm } from "@/components/cms/post-form";
import { requirePermission } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";

export const metadata = { title: "New post" };

export default async function NewPostPage() {
  const session = await requirePermission("blog.create");
  const options = await loadPostEditorOptions(session.userId);

  return (
    <>
      <PageHeader
        title="New post"
        breadcrumbs={[{ label: "Blog", href: "/admin/blog" }, { label: "New post" }]}
      />

      <PostForm
        post={null}
        {...options}
        canPublish={hasPermission({ role: session.role }, "blog.publish")}
      />
    </>
  );
}
