import { Download, MailPlus } from "lucide-react";

import { DeleteSubscriberButton } from "@/app/admin/(dashboard)/subscribers/delete-button";
import { ListToolbar } from "@/components/cms/list-toolbar";
import { PageHeader } from "@/components/cms/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { requirePermission } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { subscribers } from "@/lib/cms/repositories/subscribers";
import { formatDate } from "@/lib/utils";
import { listOptionsSchema } from "@/schemas/common";

export const metadata = { title: "Newsletter" };

export default async function SubscribersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission("enquiries.read");
  const params = await searchParams;

  const options = listOptionsSchema.parse({
    page: params.page,
    perPage: params.perPage,
    search: params.search,
  });

  const result = await subscribers.list(options);
  const canDelete = hasPermission({ role: session.role }, "enquiries.delete");

  return (
    <>
      <PageHeader
        title="Newsletter"
        description="Addresses from the signup form. Held here until an email provider is chosen; export them as CSV to import."
        actions={
          result.total > 0 ? (
            // A plain <a download>: the CSV comes from a route handler, which
            // <Link> would try to navigate to client-side.
            <Button asChild variant="outline" size="sm">
              <a href="/admin/subscribers/export" download>
                <Download className="size-4" />
                Export CSV
              </a>
            </Button>
          ) : null
        }
      />

      <Card>
        <ListToolbar showStatus={false} placeholder="Search by email…" />

        {result.items.length === 0 ? (
          <EmptyState
            icon={<MailPlus className="size-8" />}
            title={options.search ? "No subscribers match" : "No subscribers yet"}
            description={
              options.search
                ? "Try a different search."
                : "Signups from the newsletter form on the site appear here."
            }
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Email</TH>
                <TH className="hidden sm:table-cell">Form</TH>
                <TH className="hidden md:table-cell">Subscribed</TH>
                {canDelete ? <TH className="text-right">Actions</TH> : null}
              </tr>
            </THead>
            <TBody>
              {result.items.map((row) => (
                <TR key={row.id}>
                  <TD className="font-medium">{row.email}</TD>
                  <TD className="hidden text-xs text-muted-foreground sm:table-cell">
                    {row.source ?? "—"}
                  </TD>
                  <TD className="hidden text-xs text-muted-foreground md:table-cell">
                    {formatDate(row.consentedAt)}
                  </TD>
                  {canDelete ? (
                    <TD className="text-right">
                      <DeleteSubscriberButton id={row.id} email={row.email} />
                    </TD>
                  ) : null}
                </TR>
              ))}
            </TBody>
          </Table>
        )}

        <Pagination
          result={result}
          basePath="/admin/subscribers"
          searchParams={{ search: options.search || undefined }}
        />
      </Card>
    </>
  );
}
