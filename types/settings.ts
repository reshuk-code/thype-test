import type { SeoMeta } from "./seo";

/**
 * Chrome the client controls without touching code.
 *
 * Neither of these owns link *structure* — that stays in the navigation module,
 * so a URL is edited in one place and every menu that points at it follows.
 * Header and footer own presentation: what shows, in what order, with what
 * wording around it.
 */
export interface HeaderSettings {
  /** The strip above the header: seasonal offers, trek permit notices. */
  announcement: {
    enabled: boolean;
    text: string | null;
    href: string | null;
    linkLabel: string | null;
  };
  sticky: boolean;
  /** Show the phone number and email from `contact` beside the nav. */
  showContact: boolean;
  /** The one prominent button in the header. Both halves or neither. */
  cta: {
    label: string | null;
    href: string | null;
  };
  /**
   * A banner beside the logo — a sponsor or an offer. One image with the
   * message baked in, because promotions arrive as finished artwork. Hidden
   * when no image is set.
   */
  promo: {
    image: string | null;
    /** Required with an image: the banner's text is in the picture. */
    alt: string | null;
    href: string | null;
  };
}

/** The sidebar beside listings and articles. */
export interface SidebarSettings {
  /** e.g. "My last adventure". Blank hides the photo grid. */
  galleryHeading: string | null;
  /** Up to six photos, in display order. */
  gallery: string[];
  /** Where the grid links, e.g. an Instagram profile. Optional. */
  galleryHref: string | null;
}

/**
 * One column of footer links.
 *
 * `menuKey` names a menu from the navigation module rather than repeating its
 * links here: two sources of truth for a URL is how a footer ends up pointing
 * at a page that moved two months ago.
 */
export interface FooterColumn {
  heading: string;
  menuKey: string;
}

export interface FooterSettings {
  /** Short paragraph under the site name. Falls back to `tagline` when blank. */
  blurb: string | null;
  columns: FooterColumn[];
  showSocial: boolean;
  showContact: boolean;
  /** Supports the tokens {year} and {siteName}. Blank means the default line. */
  copyright: string | null;
  /** Company registration, licence or tax number — a legal requirement in some markets. */
  legalNote: string | null;
  /** The signup band above the footer. Signups land under Newsletter. */
  newsletter: {
    enabled: boolean;
    heading: string | null;
    text: string | null;
  };
}

/** Site-wide settings editable from /admin/settings. */
export interface SiteSettings {
  siteName: string;
  tagline: string;
  logo: string | null;
  favicon: string | null;
  /** Canonical public origin, e.g. "https://example.com". No trailing slash. */
  siteUrl: string;
  locale: string;
  timezone: string;
  contact: {
    email: string | null;
    phone: string | null;
    whatsapp: string | null;
    address: string | null;
  };
  social: {
    facebook: string | null;
    instagram: string | null;
    twitter: string | null;
    youtube: string | null;
    tripadvisor: string | null;
  };
  /** Defaults applied when an entity leaves its own SEO fields blank. */
  defaultSeo: Pick<
    SeoMeta,
    "title" | "description" | "ogImage" | "twitterCard" | "robots"
  >;
  /** Site-wide analytics / verification snippets. Rendered in <head>. */
  integrations: {
    googleAnalyticsId: string | null;
    googleTagManagerId: string | null;
    facebookPixelId: string | null;
    googleSiteVerification: string | null;
  };
  header: HeaderSettings;
  footer: FooterSettings;
  sidebar: SidebarSettings;
  maintenanceMode: boolean;
}

export interface Redirect {
  id: string;
  source: string;
  destination: string;
  permanent: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
