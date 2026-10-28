import { AuthorForm } from "@/components/cms/author-form";
import { PageHeader } from "@/components/cms/page-header";
import { AUTHORS_BASE_PATH } from "@/config/site-paths";
import { requirePermission } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { settings } from "@/lib/cms/repositories/settings";
import { users } from "@/lib/cms/repositories/users";

export const metadata = { title: "New author" };

export default async function NewAuthorPage() {
  const session = await requirePermission("authors.create");
  const canReadUsers = hasPermission({ role: session.role }, "users.read");

  const [accounts, siteUrl] = await Promise.all([
    canReadUsers ? users.list({ perPage: 200 }) : null,
    settings.siteUrl(),
  ]);

  return (
    <>
      <PageHeader
        title="New author"
        breadcrumbs={[{ label: "Authors", href: "/admin/authors" }, { label: "New author" }]}
      />

      <AuthorForm
        author={null}
        accountOptions={(accounts?.items ?? []).map(({ id, name }) => ({ id, name }))}
        siteUrl={siteUrl}
        basePath={AUTHORS_BASE_PATH}
        canPublish={hasPermission({ role: session.role }, "authors.publish")}
      />
    </>
  );
}
