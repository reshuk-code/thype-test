import { notFound } from "next/navigation";

import { AuthorForm } from "@/components/cms/author-form";
import { PageHeader } from "@/components/cms/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { AUTHORS_BASE_PATH } from "@/config/site-paths";
import { requirePermission } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { authors } from "@/lib/cms/repositories/authors";
import { settings } from "@/lib/cms/repositories/settings";
import { users } from "@/lib/cms/repositories/users";
import { describeRecord } from "@/lib/record-meta";

export const metadata = { title: "Edit author" };

export default async function EditAuthorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePermission("authors.update");
  const { id } = await params;
  const canReadUsers = hasPermission({ role: session.role }, "users.read");

  const [author, accounts, siteUrl] = await Promise.all([
    authors.get(id),
    canReadUsers ? users.list({ perPage: 200 }) : null,
    settings.siteUrl(),
  ]);

  if (!author) notFound();

  return (
    <>
      <PageHeader
        title={author.name}
        description={describeRecord(author)}
        breadcrumbs={[{ label: "Authors", href: "/admin/authors" }, { label: author.name }]}
        actions={<StatusBadge status={author.status} />}
      />

      <AuthorForm
        author={author}
        accountOptions={(accounts?.items ?? []).map(({ id: userId, name }) => ({
          id: userId,
          name,
        }))}
        siteUrl={siteUrl}
        basePath={AUTHORS_BASE_PATH}
        canPublish={hasPermission({ role: session.role }, "authors.publish")}
      />
    </>
  );
}
