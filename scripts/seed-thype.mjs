#!/usr/bin/env node
/**
 * Local development seed for Thype: authors, destinations, sample stories, a
 * Home page built from the editorial blocks, menus, and the header/footer
 * settings the design uses.
 *
 * Development only. It writes to the `local` JSON adapter (.cms-data/) and
 * refuses to run against anything else. Sample text is obviously sample text;
 * none of it is client content and none of it is committed (.cms-data/ and
 * public/uploads/ are gitignored).
 *
 * Usage:
 *   node scripts/seed-thype.mjs --images <folder of .jpg files> --yes
 *
 * Images are optional. Pass a folder of photos (any names) and they are copied
 * to public/uploads/thype-seed/ and spread across the stories; without one,
 * stories render with empty image boxes.
 *
 * Leaves users.json, the session secret and any other collection untouched.
 * The collections it writes are backed up first.
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, ".cms-data");
const UPLOAD_DIR = path.join(ROOT, "public", "uploads", "thype-seed");
const WRITES = ["authors", "destinations", "posts", "pages", "menus"];

const args = process.argv.slice(2);
const imagesArg = args.includes("--images") ? args[args.indexOf("--images") + 1] : null;

/* ------------------------------------------------------------------ guards */

async function databaseProvider() {
  if (process.env.CMS_DATABASE) return process.env.CMS_DATABASE;
  for (const file of [".env.local", ".env"]) {
    try {
      const text = await readFile(path.join(ROOT, file), "utf8");
      const match = /^\s*CMS_DATABASE\s*=\s*["']?([a-z]+)/m.exec(text);
      if (match) return match[1];
    } catch {
      // No such file.
    }
  }
  const config = await readFile(path.join(ROOT, "cms.config.ts"), "utf8");
  return /^\s*database:\s*"([^"]+)"/m.exec(config)?.[1] ?? "local";
}

if ((await databaseProvider()) !== "local") {
  console.error("Refusing: this seed only writes to the local JSON adapter (CMS_DATABASE=local).");
  process.exit(1);
}

if (!args.includes("--yes")) {
  console.log(`This rewrites ${WRITES.join(", ")} in .cms-data/ (backed up first)`);
  console.log("and updates site settings. Re-run with --yes to continue.");
  process.exit(0);
}

/* ----------------------------------------------------------------- helpers */

const id = (seed) => {
  const hex = createHash("sha256").update(`thype:${seed}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};
const daysAgo = (days) => new Date(Date.now() - days * 86_400_000).toISOString();

const SEO = {
  focusKeyword: null, title: null, description: null, canonical: null, robots: "index",
  noFollow: false, ogTitle: null, ogDescription: null, ogImage: null,
  twitterCard: "summary_large_image", structuredData: null,
};

const text = (value) => ({ type: "text", text: value });
const p = (value) => ({ type: "paragraph", content: [text(value)] });
const h2 = (value) => ({ type: "heading", attrs: { level: 2 }, content: [text(value)] });
const ul = (items) => ({
  type: "bulletList",
  content: items.map((item) => ({ type: "listItem", content: [p(item)] })),
});
const quote = (value) => ({ type: "blockquote", content: [p(value)] });
const img = (src, alt) => ({ type: "image", attrs: { src, alt } });
const doc = (...nodes) => JSON.stringify({ type: "doc", content: nodes });

const SAMPLE =
  "Sample paragraph for local development. It stands in for a few sentences of real reporting so the layout, line length and spacing can be checked against the design. Replace it with the story.";

/* ------------------------------------------------------------------ images */

let photos = [];
if (imagesArg) {
  const files = (await readdir(imagesArg)).filter((name) => /\.jpe?g$/i.test(name)).sort();
  await mkdir(UPLOAD_DIR, { recursive: true });
  for (const name of files) {
    const safe = name.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
    await copyFile(path.join(imagesArg, name), path.join(UPLOAD_DIR, safe));
    photos.push(`/uploads/thype-seed/${safe}`);
  }
  // Wide photos first: they suit covers; the small ones go to thumbnails.
  console.log(`  copied ${photos.length} photos to public/uploads/thype-seed/`);
}
const photo = (index) => (photos.length ? photos[index % photos.length] : null);

/* ------------------------------------------------------------------- users */

let ownerId = null;
try {
  const users = JSON.parse(await readFile(path.join(DATA_DIR, "users.json"), "utf8"));
  ownerId = users[0]?.id ?? null;
} catch {
  // No admin yet; records are attributed to nobody, which the admin tolerates.
}

const base = (collection, key, days) => ({
  id: id(`${collection}:${key}`),
  status: "published",
  publishedAt: daysAgo(days),
  updatedBy: ownerId,
  createdAt: daysAgo(days + 3),
  updatedAt: daysAgo(Math.max(0, days - 1)),
});

/* ----------------------------------------------------------------- content */

const authors = [
  {
    ...base("authors", "sample-editor", 400),
    name: "Sample Editor",
    slug: "sample-editor",
    jobTitle: "Editor (sample profile)",
    bio: "A placeholder author profile for local development. Real bylines are created under Authors in the admin.",
    avatar: photo(0),
    links: { website: "https://example.com" },
    userId: ownerId,
    seo: SEO,
  },
  {
    ...base("authors", "sample-contributor", 380),
    name: "Sample Contributor",
    slug: "sample-contributor",
    jobTitle: "Contributor (sample profile)",
    bio: "A second placeholder profile, linked to no CMS account: a guest writer.",
    avatar: photo(1),
    links: {},
    userId: null,
    seo: SEO,
  },
];

const destinationSeeds = [
  ["rome", "Rome", "Italy"],
  ["kotor", "Kotor", "Montenegro"],
  ["kyoto", "Kyoto", "Japan"],
  ["new-york", "New York", "United States"],
];
const destinations = destinationSeeds.map(([slug, name, country], index) => ({
  ...base("destinations", slug, 300),
  name,
  slug,
  shortDescription: `Sample destination for local development: ${name}.`,
  description: doc(p(SAMPLE), h2("Getting around"), p(SAMPLE)),
  country,
  region: null,
  latitude: null,
  longitude: null,
  highlights: doc(ul(["Sample highlight one", "Sample highlight two", "Sample highlight three"])),
  faqs: [],
  bestSeason: [],
  typicalDuration: null,
  featured: index < 2,
  order: index,
  featuredImage: photo(index + 4),
  featuredImageHorizontal: null,
  featuredImageVertical: null,
  bannerImage: photo(index + 10),
  gallery: [],
  seo: SEO,
}));
const destinationId = (slug) => id(`destinations:${slug}`);

const postSeeds = [
  ["how-to-get-around-rome-on-the-cheap", "How to Get Around Rome on the Cheap", "Europe", ["rome"], ["budget", "transport"], true],
  ["europe-explained-in-fewer-than-140-characters", "Europe Explained in Fewer than 140 Characters", "Europe", [], ["planning"], true],
  ["this-weeks-top-stories-about-holidays", "This Week's Top Stories About Holidays", "Travel Guides", [], ["planning"], true],
  ["a-suggested-itinerary-for-kyoto", "How to Spend Your Time in Kyoto: A Suggested Itinerary", "Travel Guides", ["kyoto"], ["itinerary"], true],
  ["you-had-a-million-dollars-where-would-you-go", "You Had a Million Dollars, Where Would You Go?", "Balkans", ["kotor"], ["luxury"], false],
  ["a-weekend-in-kotor", "A Weekend in Kotor Without the Crowds", "Balkans", ["kotor"], ["weekend"], false],
  ["new-york-on-foot", "New York on Foot: Five Neighbourhood Walks", "America", ["new-york"], ["walking"], false],
  ["street-food-in-kyoto", "Street Food in Kyoto, Stall by Stall", "Asia", ["kyoto"], ["food"], false],
  ["packing-for-a-city-break", "Packing for a City Break: A Short List", "Travel Guides", [], ["packing"], false],
  ["rome-after-dark", "Rome After Dark", "Europe", ["rome"], ["night"], false],
  ["a-slow-week-in-the-catskills", "A Slow Week in the Catskills", "America", ["new-york"], ["nature"], false],
];

const posts = postSeeds.map(([slug, title, category, places, tags, featured], index) => {
  const cover = photo(index + 2);
  const body = doc(
    p(SAMPLE),
    h2("Explore the City on Foot"),
    p(SAMPLE),
    ...(photo(index + 20) ? [img(photo(index + 20), "Sample inline photo")] : []),
    quote("A sample pull quote. Placed straight after an image, it sits beside it on wide screens."),
    h2("Use Public Transportation"),
    p(SAMPLE),
    h2("Eat Like a Local"),
    p(SAMPLE),
    h2("Quick Travel Tips"),
    ul(["Sample tip one.", "Sample tip two.", "Sample tip three.", "Sample tip four."]),
  );
  return {
    ...base("posts", slug, 2 + index * 4),
    title,
    slug,
    excerpt: "Sample excerpt for local development: a sentence or two that sells the story in a listing.",
    content: body,
    body: [{ id: id(`block:${slug}`), type: "rich-text", props: { content: body } }],
    featuredImage: cover,
    featuredImageAlt: cover ? `Sample photo for “${title}”` : null,
    featuredImageCaption: null,
    featuredImageCredit: cover ? "Design hand-off placeholder" : null,
    authorId: ownerId,
    authorProfileId: authors[index % 2].id,
    authorName: authors[index % 2].name,
    category,
    tags,
    destinationIds: places.map(destinationId),
    relatedPostIds: [],
    featured,
    showToc: true,
    readingMinutes: 3,
    seo: SEO,
  };
});

const tile = (n, label, image, href) => ({
  [`tile${n}Label`]: label,
  [`tile${n}Image`]: image ?? "",
  [`tile${n}Href`]: href,
});

const page = (slug, title, excerpt, body = [], days = 400) => ({
  ...base("pages", slug, days),
  title,
  slug,
  excerpt,
  body,
  featuredImage: null,
  parentId: null,
  order: 0,
  showInNavigation: false,
  template: null,
  meta: {},
  seo: SEO,
});

const placeholderBody = (what) => [
  {
    id: id(`block:${what}`),
    type: "rich-text",
    props: {
      content: doc(p(`[${what} to be provided by the client. This placeholder is editable under Pages.]`)),
    },
  },
];

const pages = [
  page("/", "Home", null, [
    { id: id("home:strip"), type: "story-strip", props: { heading: "Featured stories", source: "featured", limit: 4 } },
    {
      id: id("home:tiles"),
      type: "collection-tiles",
      props: {
        heading: "Explore by region",
        ...tile(1, "Europe", photo(14), "/category/europe/"),
        ...tile(2, "America", photo(15), "/category/america/"),
        ...tile(3, "Balkans", photo(16), "/category/balkans/"),
        ...tile(4, "Asia", photo(17), "/category/asia/"),
      },
    },
    { id: id("home:guides"), type: "category-strip", props: { heading: "Travel Guides", category: "Travel Guides", limit: 3 } },
    { id: id("home:feed"), type: "story-feed", props: { heading: "", category: "", perPage: 7, showSidebar: true } },
  ]),
  page("/about", "About", null, placeholderBody("About text")),
  page("/privacy-policy", "Privacy Policy", null, placeholderBody("Privacy policy")),
  page("/terms", "Terms", null, placeholderBody("Terms of use")),
  page("/affiliates", "Affiliates", null, placeholderBody("Affiliate disclosure")),
  page("/contact", "Contact", "Questions, corrections or pitches: write to us here."),
];

const link = (menu, key, label, url) => ({
  id: id(`menu:${menu}:${key}`), label, target: "custom", pageId: null, entityType: null,
  entityId: null, url, openInNewTab: false, visible: true, children: [],
});
const menu = (key, name, items) => ({
  id: id(`menus:${key}`), key, name, items,
  createdAt: daysAgo(400), updatedAt: daysAgo(400),
});
const menus = [
  menu("main", "Main navigation", [
    link("main", "home", "Home", "/"),
    link("main", "guides", "Travel Guides", "/category/travel-guides/"),
    link("main", "europe", "Europe", "/category/europe/"),
    link("main", "america", "America", "/category/america/"),
    link("main", "asia", "Asia", "/category/asia/"),
    link("main", "balkans", "Balkans", "/category/balkans/"),
  ]),
  menu("utility", "Top bar", [
    link("utility", "about", "About", "/about/"),
    link("utility", "affiliates", "Affiliates", "/affiliates/"),
    link("utility", "contact", "Contact me", "/contact/"),
  ]),
  menu("footer", "Footer", [
    link("footer", "about", "About", "/about/"),
    link("footer", "affiliates", "Affiliates", "/affiliates/"),
    link("footer", "contact", "Contact Me", "/contact/"),
  ]),
];

/* ------------------------------------------------------------------- write */

await mkdir(DATA_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join(DATA_DIR, `.seed-backup-${stamp}`);
for (const name of [...WRITES, "_kv"]) {
  const file = path.join(DATA_DIR, `${name}.json`);
  if (!existsSync(file)) continue;
  await mkdir(backupDir, { recursive: true });
  await copyFile(file, path.join(backupDir, `${name}.json`));
}

/*
 * Merged, not replaced: records someone created by hand are kept. A seeded
 * record replaces only its own earlier copy (same id), and is skipped when a
 * hand-made record already holds its slug or menu key, so re-running the seed
 * never collides with real work.
 */
const collections = { authors, destinations, posts, pages, menus };
for (const [name, seeded] of Object.entries(collections)) {
  const file = path.join(DATA_DIR, `${name}.json`);
  const existing = existsSync(file) ? JSON.parse(await readFile(file, "utf8")) : [];
  const seededIds = new Set(seeded.map((record) => record.id));
  const kept = existing.filter((record) => !seededIds.has(record.id));
  const taken = new Set(kept.map((record) => record.slug ?? record.key));
  const added = seeded.filter((record) => !taken.has(record.slug ?? record.key));

  await writeFile(file, `${JSON.stringify([...kept, ...added], null, 2)}\n`);
  console.log(
    `  ${String(added.length).padStart(3)}  ${name}` +
      (kept.length ? ` (kept ${kept.length} existing)` : "") +
      (added.length < seeded.length ? ` (skipped ${seeded.length - added.length}: slug in use)` : ""),
  );
}

const kvFile = path.join(DATA_DIR, "_kv.json");
const kv = existsSync(kvFile) ? JSON.parse(await readFile(kvFile, "utf8")) : {};
const current = kv.site_settings ?? {};
kv.site_settings = {
  ...current,
  siteName: "Thype",
  social: {
    ...(current.social ?? {}),
    instagram: "https://www.instagram.com/",
    youtube: "https://www.youtube.com/",
    facebook: "https://www.facebook.com/",
    twitter: "https://x.com/",
  },
  sidebar: {
    galleryHeading: "My last adventure",
    gallery: [24, 25, 26, 27, 28, 29].map(photo).filter(Boolean),
    galleryHref: null,
  },
  footer: {
    ...(current.footer ?? {}),
    copyright: "© {year} {siteName}. All rights reserved.",
    newsletter: {
      enabled: true,
      heading: "Latest Travel Tips",
      text: "Subscribe to Our Newsletter & Get Latest Updates.",
    },
  },
};
await writeFile(kvFile, `${JSON.stringify(kv, null, 2)}\n`);
console.log("  settings updated");
if (existsSync(backupDir)) console.log(`\nPrevious files backed up to ${path.relative(ROOT, backupDir)}`);
