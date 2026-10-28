import type { RichDoc, RichNode } from "@/types/rich-text";

/**
 * Stable anchor ids for a document's headings, and the table of contents built
 * from them.
 *
 * Both the renderer and the table of contents call `headingAnchors`, so a TOC
 * link and the heading it points at can never disagree about an id. Pure and
 * framework-free so it can be unit-tested without React.
 */

export interface TocEntry {
  id: string;
  text: string;
  /** 2 or 3. The page title owns h1, and h4 is too fine-grained for a TOC. */
  level: 2 | 3;
}

/**
 * Ids the page chrome already uses. A heading called "Main content" must not
 * steal the skip link's target.
 */
const RESERVED_IDS = ["main-content"];

/** The level the renderer will actually draw, clamped the same way. */
export function renderedHeadingLevel(node: RichNode): 2 | 3 | 4 {
  const raw = Number(node.attrs?.level);
  return raw === 3 || raw === 4 ? raw : 2;
}

export function headingText(node: RichNode): string {
  if (node.type === "text") return node.text ?? "";
  return (node.content ?? []).map(headingText).join("");
}

function baseAnchor(text: string): string {
  const slug = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80)
    .replace(/-$/, "");
  return slug || "section";
}

/**
 * Index into `doc.content` → anchor id, for every top-level heading.
 *
 * Duplicate headings get `-2`, `-3` suffixes in document order, which keeps
 * ids stable as long as the headings above them do not change.
 */
export function headingAnchors(doc: RichDoc): Map<number, string> {
  const used = new Set(RESERVED_IDS);
  const anchors = new Map<number, string>();

  doc.content.forEach((node, index) => {
    if (node.type !== "heading") return;

    const base = baseAnchor(headingText(node));
    let id = base;
    for (let suffix = 2; used.has(id); suffix += 1) id = `${base}-${suffix}`;

    used.add(id);
    anchors.set(index, id);
  });

  return anchors;
}

/** h2 and h3 headings with their anchors, in document order. */
export function buildToc(doc: RichDoc): TocEntry[] {
  const anchors = headingAnchors(doc);
  const entries: TocEntry[] = [];

  doc.content.forEach((node, index) => {
    const id = anchors.get(index);
    if (!id) return;

    const level = renderedHeadingLevel(node);
    const text = headingText(node).trim();
    if (level === 4 || !text) return;

    entries.push({ id, text, level });
  });

  return entries;
}
