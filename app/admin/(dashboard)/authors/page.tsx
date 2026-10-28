import { Plus, UserRound } from "lucide-react";
import Link from "next/link";

import { AuthorRowActions } from "@/app/admin/(dashboard)/authors/row-actions";
import { ListToolbar } from "@/components/cms/list-toolbar";
import { MediaThumb } from "@/components/cms/media-thumb";
import { PageHeader } from "@/components/cms/page-header";
import { StatusBadge } from "@/components/ui/badge";
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
import { listOptionsSchema } from "@/schemas/common";

export const metadata = { title: "Authors" };

export default async function AuthorsListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission("authors.read");
  const params = await searchParams;

  const options = listOptionsSchema.parse({
    page: params.page,
    perPage: params.perPage,
    search: params.search,
    status: params.status,
    sort: params.sort,
    order: params.order,
  });

  const result = await authors.list({ ...options, sort: "updatedAt" });

  const canCreate = hasPermission({ role: session.role }, "authors.create");
  const canUpdate = hasPermission({ role: session.role }, "authors.update");
  const canDelete = hasPermission({ role: session.role }, "authors.delete");
  const canPublish = hasPermission({ role: session.role }, "authors.publish");

  const filtered = Boolean(options.search) || options.status !== "any";

  return (
    <>
      <PageHeader
        title="Authors"
        description="Public bylines: name, portrait, bio and links. Separate from CMS accounts, so guest writers need no login."
        actions={
          canCreate ? (
            <Button asChild size="sm">
              <Link href="/admin/authors/new">
                <Plus className="size-4" />
                New author
              </Link>
            </Button>
          ) : null
        }
      />

      <Card>
        <ListToolbar placeholder="Search authors by name or role…" />

        {result.items.length === 0 ? (
          <EmptyState
            icon={<UserRound className="size-8" />}
            title={filtered ? "No authors match those filters" : "No authors yet"}
            description={
              filtered
                ? "Try a different search term, or clear the status filter."
                : "Add the people who write for the publication. Each published profile gets its own page."
            }
            action={
              canCreate && !filtered ? (
                <Button asChild size="sm">
                  <Link href="/admin/authors/new">Add the first author</Link>
                </Button>
              ) : null
            }
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Name</TH>
                <TH className="hidden sm:table-cell">Account</TH>
                <TH className="hidden md:table-cell">Status</TH>
                <TH className="text-right">Actions</TH>
              </tr>
            </THead>

            <TBody>
              {result.items.map((author) => (
                <TR key={author.id}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <div className="size-9 shrink-0 overflow-hidden rounded-full border border-border">
                        <MediaThumb
                          url={author.avatar ?? ""}
                          kind={author.avatar ? "image" : "other"}
                          alt=""
                        />
                      </div>
                      <div className="min-w-0">
                        {canUpdate ? (
                          <Link
                            href={`/admin/authors/${author.id}`}
                            className="font-medium hover:text-primary"
                          >
                            {author.name}
                          </Link>
                        ) : (
                          <span className="font-medium">{author.name}</span>
                        )}
                        <span className="block truncate text-xs text-muted-foreground">
                          <code>{author.slug}</code>
                          {author.jobTitle ? ` · ${author.jobTitle}` : ""}
                        </span>
                      </div>
                    </div>
                  </TD>

                  <TD className="hidden text-xs text-muted-foreground sm:table-cell">
                    {author.userId ? "Linked" : "Guest"}
                  </TD>

                  <TD className="hidden md:table-cell">
                    <StatusBadge status={author.status} />
                  </TD>

                  <TD className="text-right">
                    <AuthorRowActions
                      author={{ id: author.id, name: author.name, status: author.status }}
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
          basePath="/admin/authors"
          searchParams={{
            search: options.search || undefined,
            status: options.status === "any" ? undefined : options.status,
          }}
        />
      </Card>
    </>
  );
}
