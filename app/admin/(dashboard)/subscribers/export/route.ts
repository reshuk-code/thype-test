import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth";
import { CmsError } from "@/lib/cms/errors";
import { subscribers } from "@/lib/cms/repositories/subscribers";

/**
 * CSV export of the newsletter list, for importing into whichever provider
 * the client chooses. Gated on the same permission as reading the inbox.
 */
export async function GET() {
  try {
    await requirePermission("enquiries.read");
  } catch (error) {
    const status = error instanceof CmsError ? error.status : 401;
    return NextResponse.json({ error: "Not authorised." }, { status });
  }

  const rows = await subscribers.all();
  const lines = [
    ["email", "source", "consented_at"],
    ...rows.map((row) => [row.email, row.source ?? "", row.consentedAt]),
  ].map((cells) => cells.map(csvCell).join(","));

  return new NextResponse(`${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="subscribers-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Quotes a cell, and defuses spreadsheet formulas: a value starting with
 * = + - @ would otherwise run when the file is opened in Excel.
 */
function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}
