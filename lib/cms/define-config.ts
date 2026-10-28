/**
 * Configuration contract for a CMS project.
 *
 * Kept separate from the loader (`lib/cms/config.ts`) so that the root
 * `cms.config.ts` can import `defineCmsConfig` without creating an import
 * cycle with the module that reads it.
 */
import { z } from "zod";

import {
  DATABASE_PROVIDER_IDS,
  STORAGE_PROVIDER_IDS,
  type DatabaseProviderId,
  type StorageProviderId,
} from "@/types/connections";

/** Every module that can be switched off for a given client project. */
export const CMS_MODULES = [
  "pages",
  "blog",
  "authors",
  "media",
  "destinations",
  "regions",
  "tours",
  "activities",
  "testimonials",
  "faqs",
  "navigation",
  "seo",
  "redirects",
  "settings",
  "enquiries",
  "bookings",
  "customers",
  "users",
  "roles",
  "integrations",
  "database",
  "developer",
] as const;

export type CmsModuleKey = (typeof CMS_MODULES)[number];

/**
 * Provider ids come from types/connections.ts so there is one list, not two
 * that can drift apart.
 */
export type DatabaseProvider = DatabaseProviderId;
export type StorageProvider = StorageProviderId;

const moduleFlagsSchema = z.partialRecord(z.enum(CMS_MODULES), z.boolean());

export const cmsConfigSchema = z.object({
  /** Fallback site name. The Settings module overrides this at runtime. */
  siteName: z.string().min(1),
  /** Fallback public origin. Overridden by NEXT_PUBLIC_SITE_URL / settings. */
  siteUrl: z.string().default("http://localhost:3000"),
  database: z.enum(DATABASE_PROVIDER_IDS).default("local"),
  storage: z.enum(STORAGE_PROVIDER_IDS).default("local"),
  /**
   * Modules omitted here fall back to `true`, except the ones listed as
   * off-by-default in DEFAULT_MODULES below.
   */
  modules: moduleFlagsSchema.default({}),
  admin: z
    .object({
      /** Where the admin panel is mounted. Change requires moving app/admin. */
      basePath: z.string().default("/admin"),
      brandName: z.string().nullable().default(null),
      logo: z.string().nullable().default(null),
      /** Show the light/dark toggle in the admin header. */
      themeToggle: z.boolean().default(true),
    })
    .prefault({}),
  frontend: z
    .object({
      /**
       * Serve CMS pages that have no hand-written route through the
       * `app/[...slug]` catch-all. Turn off for a fully hand-built frontend.
       */
      catchAllRoutes: z.boolean().default(true),
      /** Emit /sitemap.xml and /robots.txt from CMS content. */
      sitemap: z.boolean().default(true),
    })
    .prefault({}),
  /** Locales are declared now so i18n can be layered on without a migration. */
  locales: z.array(z.string()).default(["en"]),
  defaultLocale: z.string().default("en"),
});

export type CmsConfigInput = z.input<typeof cmsConfigSchema>;
export type CmsConfig = z.output<typeof cmsConfigSchema>;

/** Modules that stay off unless a project explicitly enables them. */
export const DEFAULT_MODULES: Record<CmsModuleKey, boolean> = {
  pages: true,
  blog: true,
  authors: true,
  media: true,
  destinations: true,
  regions: true,
  tours: true,
  activities: true,
  testimonials: true,
  faqs: true,
  navigation: true,
  seo: true,
  redirects: true,
  settings: true,
  enquiries: true,
  bookings: false,
  customers: false,
  users: true,
  roles: true,
  integrations: true,
  database: true,
  developer: true,
};

/**
 * Identity helper that gives `cms.config.ts` full type-checking and
 * autocompletion. Validation happens in the loader, not here, so a config
 * error surfaces with a readable message at startup rather than at import.
 */
export function defineCmsConfig(config: CmsConfigInput): CmsConfigInput {
  return config;
}
