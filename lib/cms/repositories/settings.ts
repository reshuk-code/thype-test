import "server-only";

import { getCmsConfig } from "@/lib/cms/config";
import { getDatabase } from "@/lib/database";
import type { SiteSettings } from "@/types/settings";
import { EMPTY_SEO } from "@/types/seo";

const KV_KEY = "site_settings";

/**
 * Settings repository.
 *
 * Settings are a singleton, stored in the adapter's key/value area. Stored
 * values are merged over defaults derived from `cms.config.ts`, so a project
 * that has never opened the Settings screen still gets a sane site name and
 * URL, and adding a new setting never needs a data migration.
 */
function defaults(): SiteSettings {
  const config = getCmsConfig();

  return {
    siteName: config.siteName,
    tagline: "",
    logo: null,
    favicon: null,
    siteUrl: config.siteUrl,
    locale: config.defaultLocale,
    timezone: "Asia/Kathmandu",
    contact: { email: null, phone: null, whatsapp: null, address: null },
    social: {
      facebook: null,
      instagram: null,
      twitter: null,
      youtube: null,
      tripadvisor: null,
    },
    defaultSeo: {
      title: null,
      description: null,
      ogImage: null,
      twitterCard: EMPTY_SEO.twitterCard,
      robots: EMPTY_SEO.robots,
    },
    integrations: {
      googleAnalyticsId: null,
      googleTagManagerId: null,
      facebookPixelId: null,
      googleSiteVerification: null,
    },
    header: {
      announcement: { enabled: false, text: null, href: null, linkLabel: null },
      sticky: true,
      showContact: false,
      cta: { label: null, href: null },
      promo: { image: null, alt: null, href: null },
    },
    sidebar: { galleryHeading: null, gallery: [], galleryHref: null },
    footer: {
      blurb: null,
      // Empty rather than a guess at menu keys that may not exist: the footer
      // falls back to the developer's own links until the client builds menus.
      columns: [],
      showSocial: true,
      showContact: true,
      copyright: null,
      legalNote: null,
      newsletter: { enabled: false, heading: null, text: null },
    },
    maintenanceMode: false,
  };
}

/**
 * Merge one stored header/footer over its defaults.
 *
 * Header nests two levels (announcement, cta), which is why this is a helper
 * rather than the one-line spread the flatter sections get. Shared by `get`
 * and `update` so a partial save and a partial read cannot disagree.
 */
function mergeChrome(
  base: SiteSettings,
  patch: Partial<SiteSettings>,
): Pick<SiteSettings, "header" | "footer"> {
  return {
    header: {
      ...base.header,
      ...patch.header,
      announcement: {
        ...base.header.announcement,
        ...patch.header?.announcement,
      },
      cta: { ...base.header.cta, ...patch.header?.cta },
      promo: { ...base.header.promo, ...patch.header?.promo },
    },
    // `columns` is an array, so the patch replaces it wholesale. That is what
    // the footer form posts — removing the last column has to mean none left,
    // not "no change".
    footer: {
      ...base.footer,
      ...patch.footer,
      newsletter: { ...base.footer.newsletter, ...patch.footer?.newsletter },
    },
  };
}

export const settings = {
  async get(): Promise<SiteSettings> {
    const db = await getDatabase();
    const stored = await db.kv.get<Partial<SiteSettings>>(KV_KEY);
    const base = defaults();

    if (!stored) return base;

    // An explicit merge is clearer (and safer) than a generic deep-merge
    // helper: each section says what it does with a key the store has not
    // seen, which is how adding a setting avoids needing a data migration.
    return {
      ...base,
      ...stored,
      contact: { ...base.contact, ...stored.contact },
      social: { ...base.social, ...stored.social },
      defaultSeo: { ...base.defaultSeo, ...stored.defaultSeo },
      integrations: { ...base.integrations, ...stored.integrations },
      sidebar: { ...base.sidebar, ...stored.sidebar },
      ...mergeChrome(base, stored),
    };
  },

  async update(patch: Partial<SiteSettings>): Promise<SiteSettings> {
    const current = await this.get();
    const next: SiteSettings = {
      ...current,
      ...patch,
      contact: { ...current.contact, ...patch.contact },
      social: { ...current.social, ...patch.social },
      defaultSeo: { ...current.defaultSeo, ...patch.defaultSeo },
      integrations: { ...current.integrations, ...patch.integrations },
      sidebar: { ...current.sidebar, ...patch.sidebar },
      ...mergeChrome(current, patch),
    };

    const db = await getDatabase();
    await db.kv.set(KV_KEY, next);
    return next;
  },

  /** Public origin used for canonicals, OG images and the sitemap. */
  async siteUrl(): Promise<string> {
    const stored = await this.get();
    return (stored.siteUrl || getCmsConfig().siteUrl).replace(/\/+$/, "");
  },
};
