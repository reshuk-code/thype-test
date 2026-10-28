import "server-only";

import { activities } from "./repositories/activities";
import { activity } from "./repositories/activity";
import { authors } from "./repositories/authors";
import { destinations } from "./repositories/destinations";
import { enquiries } from "./repositories/enquiries";
import { faqs } from "./repositories/faqs";
import { media } from "./repositories/media";
import { navigation } from "./repositories/navigation";
import { pages } from "./repositories/pages";
import { posts } from "./repositories/posts";
import { redirects } from "./repositories/redirects";
import { regions } from "./repositories/regions";
import { settings } from "./repositories/settings";
import { testimonials } from "./repositories/testimonials";
import { tours } from "./repositories/tours";
import { users } from "./repositories/users";
import { seo } from "./seo";

/**
 * The CMS SDK.
 *
 * This is the only thing a frontend developer needs to import:
 *
 *   import { cms } from "@/lib/cms";
 *
 *   const page  = await cms.pages.getBySlug("/about");
 *   const menu  = await cms.navigation.get("main");
 *   const site  = await cms.settings.get();
 *
 * Nothing in this object leaks the storage provider. Swapping Supabase for
 * MongoDB is a one-line change in cms.config.ts and no frontend file changes.
 *
 * It is server-only by design: every method reaches a database with privileged
 * credentials. Fetch in a Server Component (or a Server Action / route
 * handler) and pass plain data to Client Components.
 *
 * `activities` is the content type; `activity` is the audit log. The names
 * are one letter apart and mean entirely different things.
 *
 * `cms.enquiries` is the inbox behind the public contact form. It is the one
 * namespace with no public read: never surface it from a page.
 *
 * See docs/ROADMAP.md.
 */
export const cms = {
  pages,
  posts,
  authors,
  destinations,
  regions,
  tours,
  activities,
  testimonials,
  faqs,
  enquiries,
  media,
  navigation,
  settings,
  redirects,
  users,
  activity,
  seo,
} as const;

export type Cms = typeof cms;

export { CmsError, ConflictError, ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from "./errors";
export { getCmsConfig, getEnabledModules, isModuleEnabled } from "./config";
