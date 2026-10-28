import { z } from "zod";

import {
  bareSlugSchema,
  contentStatusSchema,
  optionalText,
  optionalUrl,
} from "./common";
import { blockInstanceSchema } from "./page";
import { richContentSchema } from "./rich-text";
import { seoSchema } from "./seo";

/** Comma-separated tags in, a de-duplicated array out. */
export const tagsSchema = z
  .string()
  .trim()
  .default("")
  .transform((value) =>
    [
      ...new Set(
        value
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      ),
    ].slice(0, 20),
  );

/** A list of record ids from repeated form inputs, de-duplicated, order kept. */
const idListSchema = (max: number) =>
  z
    .array(z.string().trim().max(64))
    .default([])
    .transform((ids) => [...new Set(ids.filter(Boolean))].slice(0, max));

/** Short text that is optional but bounded, so a paste cannot bloat the row. */
const boundedText = (max: number) =>
  optionalText.pipe(z.string().max(max, `Keep this under ${max} characters.`).nullable());

/**
 * Input accepted when creating or updating a blog post.
 *
 * `readingMinutes` is absent on purpose: it is derived from the content by the
 * repository, so it can never disagree with the words actually stored.
 */
export const postInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(200),
  slug: bareSlugSchema,
  excerpt: optionalText,
  content: richContentSchema,
  body: z.array(blockInstanceSchema).default([]),
  featuredImage: optionalUrl,
  featuredImageAlt: boundedText(300),
  featuredImageCaption: boundedText(300),
  featuredImageCredit: boundedText(200),
  authorId: z.string().trim().nullable().default(null),
  authorProfileId: z.string().trim().max(64).nullable().default(null),
  category: optionalText,
  tags: tagsSchema,
  destinationIds: idListSchema(10),
  relatedPostIds: idListSchema(6),
  featured: z.boolean().default(false),
  showToc: z.boolean().default(true),
  status: contentStatusSchema.default("draft"),
  /** Required when status is "scheduled"; ignored otherwise. */
  publishedAt: z
    .string()
    .trim()
    .nullable()
    .default(null)
    .refine(
      (value) => value === null || !Number.isNaN(Date.parse(value)),
      "Publication date is not a valid date.",
    ),
  seo: seoSchema.prefault({}),
});

export const postInputWithRulesSchema = postInputSchema.superRefine(
  (value, ctx) => {
    if (value.status === "scheduled" && !value.publishedAt) {
      ctx.addIssue({
        code: "custom",
        path: ["publishedAt"],
        message: "Pick a publication date to schedule this post.",
      });
    }

    // The lead image of an article always carries meaning, so it is never
    // "decorative" — a screen reader user should hear what the photo shows.
    if (value.featuredImage && !value.featuredImageAlt) {
      ctx.addIssue({
        code: "custom",
        path: ["featuredImageAlt"],
        message: "Describe the featured image for readers who cannot see it.",
      });
    }
  },
);

export type PostInput = z.input<typeof postInputSchema>;
export type PostInputParsed = z.output<typeof postInputSchema>;

/** Query-string parameters for the blog list, on top of the shared ones. */
export const postFiltersSchema = z.object({
  category: z.string().trim().default(""),
  tag: z.string().trim().default(""),
  author: z.string().trim().max(64).default(""),
  featured: z.enum(["", "yes", "no"]).default(""),
});

/**
 * Query-string parameters on public listing pages. Bounded so a crafted URL
 * cannot ask for page 10^9 or a megabyte search term.
 */
export const publicListParamsSchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).catch(1),
  q: z.string().trim().max(100).catch(""),
});
