import { z } from "zod";

import type { BlockInstance } from "@/types/blocks";

/**
 * Block registry.
 *
 * A block is a named Zod schema plus enough metadata for the admin to render
 * an editor for it — so a project can add a block the CMS has never heard of
 * and get a working form for free (§8).
 *
 * **The registry holds no React components.** It used to, and that was wrong:
 * this module is imported by the block editor, which is a Client Component,
 * and a registry of components would drag every block's rendering — including
 * the server-only grids that query the database — into the browser bundle.
 * The catalog here is pure data; `components/frontend/blocks/index.tsx` maps a
 * block name to the component that renders it, on the server.
 *
 * Registering a custom block from a project:
 *
 *   registerBlock({
 *     name: "price-table",
 *     label: "Price table",
 *     schema: z.object({ heading: z.string().default("") }),
 *     fields: [{ name: "heading", label: "Heading", kind: "text" }],
 *   });
 *
 * …then add `"price-table"` to the renderer map. See docs/BUILDING-A-SITE.md.
 */

/** Editor controls the admin knows how to render for a block's props. */
export type BlockFieldKind =
  | "text"
  | "textarea"
  | "richtext"
  | "number"
  | "boolean"
  | "image"
  | "gallery"
  | "select";

export interface BlockField {
  name: string;
  label: string;
  kind: BlockFieldKind;
  hint?: string;
  placeholder?: string;
  /** Required when kind is "select". */
  options?: { value: string; label: string }[];
}

export interface BlockDefinition<TProps = Record<string, unknown>> {
  name: string;
  label: string;
  description?: string;
  schema: z.ZodType<TProps>;
  /** Drives the generic editor form. Order here is the order on screen. */
  fields: BlockField[];
}

const registry = new Map<string, BlockDefinition<never>>();

export function registerBlock<TProps>(definition: BlockDefinition<TProps>): void {
  registry.set(definition.name, definition as unknown as BlockDefinition<never>);
}

export function getBlock(name: string): BlockDefinition<never> | undefined {
  return registry.get(name);
}

export function listBlocks(): BlockDefinition<never>[] {
  return [...registry.values()];
}

/** Creates a block instance with schema defaults applied. */
export function createBlockInstance(
  name: string,
  props: Record<string, unknown> = {},
): BlockInstance {
  const definition = registry.get(name);
  const parsed = definition?.schema.safeParse(props);

  return {
    id: crypto.randomUUID(),
    type: name,
    props: parsed?.success ? (parsed.data as Record<string, unknown>) : props,
  };
}

/**
 * Parses a stored block's props against its registered schema.
 *
 * Returns null for a block type nobody has registered, which is how a page
 * survives a block being removed from the code: the renderer skips it rather
 * than crashing, and the stored props stay on the record untouched.
 */
export function parseBlockProps(
  block: BlockInstance,
): Record<string, unknown> | null {
  const definition = registry.get(block.type);
  if (!definition) return null;

  const parsed = definition.schema.safeParse(block.props);
  return parsed.success ? (parsed.data as Record<string, unknown>) : null;
}

/* ------------------------------------------------------------ built-ins */

/**
 * A heading every content block shares. Blank means "no heading", which is
 * what you want when a block sits directly under a page title.
 */
const headingField = z.string().default("");

/** The rich-text block's props, used by both the editor and the renderer. */
export const richTextSchema = z.object({
  content: z.string().default(""),
});

export type RichTextProps = z.infer<typeof richTextSchema>;

export const RICH_TEXT_BLOCK = "rich-text";

registerBlock({
  name: RICH_TEXT_BLOCK,
  label: "Text",
  description: "Formatted prose: headings, lists, quotes, links.",
  schema: richTextSchema,
  fields: [
    {
      name: "content",
      label: "Content",
      kind: "richtext",
    },
  ],
});

registerBlock({
  name: "hero",
  label: "Hero",
  description: "Large heading, supporting line, background image and a button.",
  schema: z.object({
    heading: headingField,
    subheading: z.string().default(""),
    image: z.string().default(""),
    ctaLabel: z.string().default(""),
    ctaHref: z.string().default(""),
  }),
  fields: [
    { name: "heading", label: "Heading", kind: "text" },
    { name: "subheading", label: "Supporting line", kind: "textarea" },
    { name: "image", label: "Background image", kind: "image" },
    { name: "ctaLabel", label: "Button label", kind: "text", placeholder: "Plan your trip" },
    { name: "ctaHref", label: "Button link", kind: "text", placeholder: "/contact" },
  ],
});

registerBlock({
  name: "image",
  label: "Image",
  schema: z.object({
    url: z.string().default(""),
    alt: z.string().default(""),
    caption: z.string().default(""),
  }),
  fields: [
    { name: "url", label: "Image", kind: "image" },
    {
      name: "alt",
      label: "Alt text",
      kind: "text",
      hint: "What the image shows, for screen readers. Leave blank if purely decorative.",
    },
    { name: "caption", label: "Caption", kind: "text" },
  ],
});

registerBlock({
  name: "gallery",
  label: "Gallery",
  schema: z.object({
    heading: headingField,
    images: z.array(z.string()).default([]),
  }),
  fields: [
    { name: "heading", label: "Heading", kind: "text" },
    { name: "images", label: "Images", kind: "gallery" },
  ],
});

registerBlock({
  name: "cta",
  label: "Call to action",
  description: "A band with a heading, a line of text and one button.",
  schema: z.object({
    heading: headingField,
    text: z.string().default(""),
    buttonLabel: z.string().default(""),
    buttonHref: z.string().default(""),
  }),
  fields: [
    { name: "heading", label: "Heading", kind: "text" },
    { name: "text", label: "Text", kind: "textarea" },
    { name: "buttonLabel", label: "Button label", kind: "text" },
    { name: "buttonHref", label: "Button link", kind: "text", placeholder: "/contact" },
  ],
});

/** Grid blocks share the same three controls, so build them from one shape. */
function gridBlock(config: {
  name: string;
  label: string;
  description: string;
  /** Extra filter control, e.g. category. */
  extra?: BlockField;
  extraSchema?: z.ZodRawShape;
  featured?: boolean;
}) {
  registerBlock({
    name: config.name,
    label: config.label,
    description: config.description,
    schema: z.object({
      heading: headingField,
      limit: z.coerce.number().int().min(1).max(24).default(6),
      ...(config.featured ? { featuredOnly: z.coerce.boolean().default(false) } : {}),
      ...(config.extraSchema ?? {}),
    }),
    fields: [
      { name: "heading", label: "Heading", kind: "text" },
      {
        name: "limit",
        label: "How many",
        kind: "number",
        hint: "Newest or highest-ordered first, depending on the type.",
      },
      ...(config.featured
        ? ([
            {
              name: "featuredOnly",
              label: "Featured only",
              kind: "boolean",
              hint: "Show only records marked as featured.",
            },
          ] as BlockField[])
        : []),
      ...(config.extra ? [config.extra] : []),
    ],
  });
}

gridBlock({
  name: "destination-grid",
  label: "Destination grid",
  description: "Published destinations, in display order.",
  featured: true,
});

gridBlock({
  name: "tour-grid",
  label: "Trip grid",
  description: "Published tour packages, in display order.",
  featured: true,
});

gridBlock({
  name: "blog-grid",
  label: "Blog grid",
  description: "Recent published posts.",
  extra: {
    name: "category",
    label: "Category",
    kind: "text",
    hint: "Leave blank for every category.",
  },
  extraSchema: { category: z.string().default("") },
});

gridBlock({
  name: "testimonials",
  label: "Testimonials",
  description: "Published reviews, in display order.",
  featured: true,
});

gridBlock({
  name: "faq",
  label: "FAQs",
  description: "Published questions, as an accordion.",
  extra: {
    name: "category",
    label: "Category",
    kind: "text",
    hint: "Leave blank for every category.",
  },
  extraSchema: { category: z.string().default("") },
});

registerBlock({
  name: "activity-grid",
  label: "Activity grid",
  description: "Published activities, in display order.",
  schema: z.object({
    heading: headingField,
    limit: z.coerce.number().int().min(1).max(24).default(8),
  }),
  fields: [
    { name: "heading", label: "Heading", kind: "text" },
    { name: "limit", label: "How many", kind: "number" },
  ],
});

registerBlock({
  name: "contact-form",
  label: "Contact form",
  description: "The enquiry form. Submissions land in /admin/enquiries.",
  schema: z.object({
    heading: headingField,
    text: z.string().default(""),
  }),
  fields: [
    { name: "heading", label: "Heading", kind: "text" },
    { name: "text", label: "Intro text", kind: "textarea" },
  ],
});

/* ------------------------------------------------------- Thype editorial */

/*
 * The sections of the Thype homepage, as blocks, so the editor decides which
 * appear and in what order from Pages → Home. Each reads published posts at
 * render time; none stores an article id, so publishing a story is enough to
 * place it. Rendered by components/frontend/thype/blocks.tsx.
 */

const postSourceField = z.enum(["featured", "latest"]).default("featured");

registerBlock({
  name: "story-strip",
  label: "Featured stories strip",
  description: "Full-width row of photo tiles with headlines. Featured stories first.",
  schema: z.object({
    heading: headingField,
    source: postSourceField,
    limit: z.coerce.number().int().min(1).max(4).default(4),
  }),
  fields: [
    {
      name: "heading",
      label: "Heading (screen readers only)",
      kind: "text",
      hint: "The strip shows no visible heading; this names it for assistive technology.",
    },
    {
      name: "source",
      label: "Stories",
      kind: "select",
      options: [
        { value: "featured", label: "Featured, topped up with the latest" },
        { value: "latest", label: "Latest" },
      ],
    },
    { name: "limit", label: "How many (1–4)", kind: "number" },
  ],
});

const TILE_COUNT = 4;

registerBlock({
  name: "collection-tiles",
  label: "Collection tiles",
  description: "Up to four photo tiles linking to categories, destinations or any page.",
  schema: z.object({
    heading: headingField,
    ...Object.fromEntries(
      Array.from({ length: TILE_COUNT }, (_, index) => [
        [`tile${index + 1}Label`, z.string().default("")],
        [`tile${index + 1}Image`, z.string().default("")],
        [`tile${index + 1}Href`, z.string().default("")],
      ]).flat(),
    ),
  }),
  fields: [
    {
      name: "heading",
      label: "Heading (screen readers only)",
      kind: "text",
    },
    ...Array.from({ length: TILE_COUNT }, (_, index): BlockField[] => [
      { name: `tile${index + 1}Label`, label: `Tile ${index + 1}: label`, kind: "text" },
      { name: `tile${index + 1}Image`, label: `Tile ${index + 1}: photo`, kind: "image" },
      {
        name: `tile${index + 1}Href`,
        label: `Tile ${index + 1}: link`,
        kind: "text",
        placeholder: "/category/europe/",
        hint: index === 0 ? "A tile with no label or no link is left out." : undefined,
      },
    ]).flat(),
  ],
});

registerBlock({
  name: "category-strip",
  label: "Category strip",
  description: "A tinted band with a centred heading and the newest stories from one category.",
  schema: z.object({
    heading: headingField,
    category: z.string().default(""),
    limit: z.coerce.number().int().min(1).max(6).default(3),
  }),
  fields: [
    { name: "heading", label: "Heading", kind: "text", placeholder: "Travel Guides" },
    {
      name: "category",
      label: "Category",
      kind: "text",
      hint: "Exactly as it is written on the posts. Blank shows the latest stories.",
    },
    { name: "limit", label: "How many", kind: "number" },
  ],
});

registerBlock({
  name: "story-feed",
  label: "Story feed with sidebar",
  description: "The latest stories, a lead then a grid, with Load more and the sidebar.",
  schema: z.object({
    heading: headingField,
    category: z.string().default(""),
    perPage: z.coerce.number().int().min(3).max(15).default(7),
    showSidebar: z.coerce.boolean().default(true),
  }),
  fields: [
    {
      name: "heading",
      label: "Heading",
      kind: "text",
      hint: "Leave blank for no visible heading.",
    },
    {
      name: "category",
      label: "Category",
      kind: "text",
      hint: "Blank for every category.",
    },
    {
      name: "perPage",
      label: "Stories before Load more",
      kind: "number",
      hint: "The first is the lead; the rest fill a two-column grid. Odd numbers fill it evenly.",
    },
    { name: "showSidebar", label: "Show the sidebar", kind: "boolean" },
  ],
});
