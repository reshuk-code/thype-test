import { defineRoutes } from "@/lib/cms/routes";

/**
 * Hand-written routes in this project.
 *
 * Declare every route you build under `app/` that a client might otherwise
 * expect to manage from the CMS. The admin shows the result at
 * /admin/developer, so nobody has to guess who owns `/tours`.
 *
 * You are not obliged to register a route — an undeclared route still works
 * perfectly. Registering it buys you two things:
 *   1. It appears in the admin route inventory instead of looking missing.
 *   2. With `cmsMetadata: true`, editors can manage its SEO from the CMS while
 *      you keep complete control of the rendering.
 *
 * Run `npm run cms:routes` to list routes in app/ that are not declared here.
 */
export default defineRoutes([
  {
    path: "/",
    label: "Home",
    cmsMetadata: true,
    description:
      "Renders the blocks of the CMS page with slug \"/\" (Pages → Home): story strip, tiles, category strip, feed.",
  },
  {
    path: "/blog",
    label: "All stories",
    cmsMetadata: true,
    // Shadows the CMS page with the same slug on purpose: prose cannot list
    // posts. The page still supplies this route's title and intro.
    description: "Every published story, newest first. Posts render at /blog/[slug].",
  },
  {
    path: "/blog/:slug",
    label: "Story",
    // Each post carries its own SEO on the record.
    description: "One story. Honours draft mode, so admin Preview works.",
  },
  {
    path: "/category/:slug",
    label: "Category",
    description:
      "Stories in one category. A CMS page at /category/<slug> sets its title, intro and SEO.",
  },
  {
    path: "/tag/:slug",
    label: "Tag",
    description: "Stories with one tag. A CMS page at /tag/<slug> sets its title and SEO.",
  },
  {
    path: "/destinations",
    label: "Destinations",
    cmsMetadata: true,
    description: "Published destinations, grouped by country, with story counts.",
  },
  {
    path: "/destinations/:slug",
    label: "Destination",
    description: "A destination's guide text and its stories. Honours draft mode.",
  },
  {
    path: "/authors/:slug",
    label: "Author",
    description: "A published author profile and their stories.",
  },
  {
    path: "/search",
    label: "Search",
    description: "Search results. Never indexed.",
  },
  {
    path: "/contact",
    label: "Contact",
    cmsMetadata: true,
    description: "Contact form. Messages land in Enquiries in the admin.",
  },
]);
