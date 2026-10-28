import { z } from "zod";

import { optionalText, optionalUrl } from "./common";

const optionalEmail = z
  .string()
  .trim()
  .transform((value) => (value.length ? value : null))
  .nullable()
  .default(null)
  .refine(
    (value) => value === null || z.email().safeParse(value).success,
    "Enter a valid email address.",
  );

export const settingsInputSchema = z.object({
  siteName: z.string().trim().min(1, "Site name is required."),
  tagline: z.string().trim().default(""),
  logo: optionalUrl,
  favicon: optionalUrl,
  siteUrl: z
    .string()
    .trim()
    .default("")
    .transform((value) => value.replace(/\/+$/, ""))
    .refine(
      (value) => value === "" || /^https?:\/\//i.test(value),
      "Site URL must start with http:// or https://.",
    ),
  locale: z.string().trim().min(2).default("en"),
  timezone: z.string().trim().min(1).default("Asia/Kathmandu"),
  contact: z
    .object({
      email: optionalEmail,
      phone: optionalText,
      whatsapp: optionalText,
      address: optionalText,
    })
    .prefault({}),
  social: z
    .object({
      facebook: optionalUrl,
      instagram: optionalUrl,
      twitter: optionalUrl,
      youtube: optionalUrl,
      tripadvisor: optionalUrl,
    })
    .prefault({}),
  defaultSeo: z
    .object({
      title: optionalText,
      description: optionalText,
      ogImage: optionalUrl,
      twitterCard: z
        .enum(["summary", "summary_large_image"])
        .default("summary_large_image"),
      robots: z.enum(["index", "noindex"]).default("index"),
    })
    .prefault({}),
  integrations: z
    .object({
      googleAnalyticsId: optionalText,
      googleTagManagerId: optionalText,
      facebookPixelId: optionalText,
      googleSiteVerification: optionalText,
    })
    .prefault({}),
  maintenanceMode: z.coerce.boolean().default(false),
});

/**
 * Header chrome.
 *
 * The announcement bar and the CTA are each two fields that only mean anything
 * together, so `superRefine` rejects half of one rather than letting the
 * frontend decide what a labelled link with no URL should do.
 */
export const headerInputSchema = z
  .object({
    announcement: z
      .object({
        enabled: z.coerce.boolean().default(false),
        text: optionalText,
        href: optionalUrl,
        linkLabel: optionalText,
      })
      .prefault({}),
    sticky: z.coerce.boolean().default(true),
    showContact: z.coerce.boolean().default(false),
    cta: z
      .object({
        label: optionalText,
        href: optionalUrl,
      })
      .prefault({}),
    promo: z
      .object({
        image: optionalUrl,
        alt: optionalText,
        href: optionalUrl,
      })
      .prefault({}),
  })
  .superRefine((value, ctx) => {
    // A banner's message is painted into the image, so without alt text a
    // screen reader user gets a link that says nothing.
    if (value.promo.image && !value.promo.alt) {
      ctx.addIssue({
        code: "custom",
        path: ["promo", "alt"],
        message: "Write out what the banner says.",
      });
    }

    if (value.announcement.enabled && !value.announcement.text) {
      ctx.addIssue({
        code: "custom",
        path: ["announcement", "text"],
        message: "Write the announcement, or switch the bar off.",
      });
    }

    if (value.announcement.linkLabel && !value.announcement.href) {
      ctx.addIssue({
        code: "custom",
        path: ["announcement", "href"],
        message: "A link label needs a link.",
      });
    }

    if (value.cta.label && !value.cta.href) {
      ctx.addIssue({
        code: "custom",
        path: ["cta", "href"],
        message: "Give the button somewhere to go.",
      });
    }

    if (value.cta.href && !value.cta.label) {
      ctx.addIssue({
        code: "custom",
        path: ["cta", "label"],
        message: "Give the button a label.",
      });
    }
  });

/**
 * Footer chrome.
 *
 * A column names a menu rather than carrying links of its own; whether that
 * menu still exists is checked when the footer renders, not here, because a
 * menu deleted after this saved would otherwise lock the client out of their
 * own footer screen.
 */
export const footerColumnSchema = z.object({
  heading: z.string().trim().min(1, "Give the column a heading.").max(60),
  menuKey: z.string().trim().min(1, "Choose a menu."),
});

export const footerInputSchema = z.object({
  blurb: optionalText,
  columns: z.array(footerColumnSchema).max(4, "Four columns is the most that fits.").default([]),
  showSocial: z.coerce.boolean().default(true),
  showContact: z.coerce.boolean().default(true),
  copyright: optionalText,
  legalNote: optionalText,
  newsletter: z
    .object({
      enabled: z.coerce.boolean().default(false),
      heading: optionalText,
      text: optionalText,
    })
    .prefault({})
    .superRefine((value, ctx) => {
      if (value.enabled && !value.heading) {
        ctx.addIssue({
          code: "custom",
          path: ["heading"],
          message: "Give the signup a heading, or switch it off.",
        });
      }
    }),
});

/** The sidebar photo grid. Saved from the header screen. */
export const sidebarInputSchema = z.object({
  galleryHeading: optionalText,
  gallery: z.array(z.string().trim().min(1)).max(6, "Six photos at most.").default([]),
  galleryHref: optionalUrl,
});

export type HeaderInput = z.input<typeof headerInputSchema>;
export type FooterInput = z.input<typeof footerInputSchema>;

export const redirectInputSchema = z
  .object({
    source: z
      .string()
      .trim()
      .min(1, "Source path is required.")
      .transform((value) => (value.startsWith("/") ? value : `/${value}`)),
    destination: z.string().trim().min(1, "Destination is required."),
    permanent: z.coerce.boolean().default(true),
    enabled: z.coerce.boolean().default(true),
  })
  .refine(
    (value) => value.source !== value.destination,
    { path: ["destination"], message: "A redirect cannot point at itself." },
  );

export type SettingsInput = z.input<typeof settingsInputSchema>;
export type RedirectInput = z.input<typeof redirectInputSchema>;
