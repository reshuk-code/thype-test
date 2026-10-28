import { z } from "zod";

import { AUTHOR_LINK_KEYS } from "@/types/content";

import {
  bareSlugSchema,
  contentStatusSchema,
  optionalText,
  optionalUrl,
} from "./common";
import { seoSchema } from "./seo";

/**
 * An absolute http(s) URL, or nothing.
 *
 * Stricter than `optionalUrl`: a social profile is always on someone else's
 * site, so a relative path is a typo, and `javascript:` must never reach an
 * `href` on the public author page.
 */
const externalUrl = z
  .string()
  .trim()
  .max(500)
  .transform((value) => (value.length ? value : null))
  .nullable()
  .default(null)
  .refine(
    (value) => {
      if (value === null) return true;
      try {
        const url = new URL(value);
        return url.protocol === "https:" || url.protocol === "http:";
      } catch {
        return false;
      }
    },
    "Enter a full address starting with https://",
  );

const linksSchema = z
  .object(
    Object.fromEntries(AUTHOR_LINK_KEYS.map((key) => [key, externalUrl])) as Record<
      (typeof AUTHOR_LINK_KEYS)[number],
      typeof externalUrl
    >,
  )
  .prefault({})
  // Blank networks are dropped rather than stored as null, so the public page
  // can iterate the object without filtering it first.
  .transform((links) =>
    Object.fromEntries(
      Object.entries(links).filter(([, value]) => value !== null),
    ) as Partial<Record<(typeof AUTHOR_LINK_KEYS)[number], string>>,
  );

/** Input accepted when creating or updating an author profile. */
export const authorInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  slug: bareSlugSchema,
  jobTitle: optionalText.pipe(z.string().max(120).nullable()),
  bio: optionalText.pipe(z.string().max(2000, "Keep the bio under 2,000 characters.").nullable()),
  avatar: optionalUrl,
  links: linksSchema,
  userId: z.string().trim().nullable().default(null),
  status: contentStatusSchema.default("draft"),
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

export const authorInputWithRulesSchema = authorInputSchema.superRefine(
  (value, ctx) => {
    if (value.status === "scheduled" && !value.publishedAt) {
      ctx.addIssue({
        code: "custom",
        path: ["publishedAt"],
        message: "Pick a publication date to schedule this profile.",
      });
    }
  },
);

export type AuthorInput = z.input<typeof authorInputSchema>;
export type AuthorInputParsed = z.output<typeof authorInputSchema>;
