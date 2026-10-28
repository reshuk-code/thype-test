import type { ContentRecord, BaseRecord, ID } from "./common";
import type { SeoMeta } from "./seo";
import type { PageBody } from "./blocks";
import type { RichListContent } from "./rich-text";

/* ------------------------------------------------------------------ media */

/** Coarse buckets the media library filters by. See `mediaKindFor()`. */
export const MEDIA_KINDS = [
  "image",
  "video",
  "document",
  "audio",
  "other",
] as const;

export type MediaKind = (typeof MEDIA_KINDS)[number];

export interface MediaItem extends BaseRecord {
  /** SHA-256 fingerprint used to reuse identical uploads. */
  contentHash?: string;
  /** Path within the storage bucket. The adapter turns this into a URL. */
  key: string;
  url: string;
  filename: string;
  mimeType: string;
  kind: MediaKind;
  /** Bytes. */
  size: number;
  width: number | null;
  height: number | null;
  altText: string | null;
  caption: string | null;
  description: string | null;
  /** Simple single-level folder, e.g. "tours" or "team". Null = root. */
  folder: string | null;
  uploadedBy: ID | null;
}

/* -------------------------------------------------------- featured images */

/**
 * The four shapes a client can hand us for one record, plus the gallery.
 *
 * One image cannot serve every slot: a 16:9 card crops a portrait badly and a
 * 1920x700 banner crops it to a sliver. Rather than generate crops — this
 * template ships no image decoder, and a crop is an editorial decision anyway —
 * each shape is its own optional URL and the frontend picks the one its layout
 * wants, falling back to `featuredImage`.
 *
 * `featuredImageVertical` is the one with a rule attached: where it is set, a
 * card grid is expected to switch to portrait tiles for that record. See
 * `pickFeaturedImage()` in `lib/images.ts`, which is the only place that
 * fallback order is written down.
 *
 * All four are flat string fields for the same reason `featuredImage` always
 * was: no adapter, table or collection changes shape, and a URL from a CDN the
 * CMS does not manage stays valid.
 */
export interface FeaturedImageSet {
  /** The default card image. Landscape, roughly 4:3 or 16:9. */
  featuredImage: string | null;
  /** A wider crop for list rows and side-by-side layouts. */
  featuredImageHorizontal: string | null;
  /** Portrait. Its presence is what switches a card grid to tall tiles. */
  featuredImageVertical: string | null;
  /** Page header. 1920x700 is the design default, not a validated constraint. */
  bannerImage: string | null;
  /** Photo gallery, in display order. */
  gallery: string[];
}

/* ------------------------------------------------------------------- blog */

export interface Post extends ContentRecord {
  title: string;
  slug: string;
  excerpt: string | null;
  /**
   * Prose body: a serialised rich text document, or Markdown if it was written
   * before the rich editor landed. `lib/rich-text.ts` reads both, which is why
   * two formats are allowed to coexist. Rendered by the frontend, not the CMS.
   */
  content: string;
  body: PageBody;
  featuredImage: string | null;
  /*
   * Alt text, caption and credit belong to this use of the image, not to the
   * file: the same photograph can need a different description beside a
   * different story. Optional on read because posts written before these
   * fields existed do not carry them.
   */
  featuredImageAlt?: string | null;
  featuredImageCaption?: string | null;
  featuredImageCredit?: string | null;
  /** The CMS account that wrote the post. Private: never rendered publicly. */
  authorId: ID | null;
  /** Byline captured at write time, so it survives the profile being deleted. */
  authorName: string | null;
  /** The public profile credited on the post — an `Author`, not a user. */
  authorProfileId?: ID | null;
  category: string | null;
  tags: string[];
  /** Destinations this story is about, in the order the editor listed them. */
  destinationIds?: ID[];
  /** Hand-picked "read next". Topped up automatically when short. */
  relatedPostIds?: ID[];
  /** Eligible for featured slots: the homepage lead, featured collections. */
  featured?: boolean;
  /** Render a table of contents built from the article's headings. */
  showToc?: boolean;
  readingMinutes: number | null;
  seo: SeoMeta;
}

/* ---------------------------------------------------------------- authors */

/** Networks an author profile can link to. Every one is optional. */
export const AUTHOR_LINK_KEYS = [
  "website",
  "instagram",
  "x",
  "facebook",
  "youtube",
  "tiktok",
  "linkedin",
] as const;

export type AuthorLinkKey = (typeof AUTHOR_LINK_KEYS)[number];

/**
 * A public byline: the person a story is credited to.
 *
 * Deliberately separate from `CmsUser`. An account holds an email, a role and
 * a password hash; a byline holds a bio and a portrait. Guest writers need a
 * byline and no account, and an account holder may not want a public profile,
 * so neither can be derived from the other.
 */
export interface Author extends ContentRecord {
  name: string;
  slug: string;
  /** Shown under the name, e.g. "Contributing editor". */
  jobTitle: string | null;
  bio: string | null;
  avatar: string | null;
  links: Partial<Record<AuthorLinkKey, string>>;
  /**
   * The CMS account this profile belongs to, if any. Lets the post editor
   * default to your own byline. Private: stripped by `toPublicAuthor()`.
   */
  userId: ID | null;
  seo: SeoMeta;
}

/** What the public site may see of an author. */
export type PublicAuthor = Omit<Author, "userId" | "updatedBy">;

/* --------------------------------------------------------------- regions */

/**
 * A region a company sells trips in — Everest, Annapurna, Mustang.
 *
 * A content type rather than a taxonomy: a region earns its own page with
 * photographs and prose, which a string on a destination cannot carry. The
 * free-text `region` on Destination is deliberately left alone; linking the two
 * would rewrite a field that eight display sites already read.
 */
export interface Region extends ContentRecord, FeaturedImageSet {
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string;
  country: string | null;
  /** Free text, e.g. "2,800-5,400 m". Not a number: ranges are the norm. */
  elevationRange: string | null;
  highlights: RichListContent;
  faqs?: TourFaq[];
  bestSeason: string[];
  featured: boolean;
  order: number;
  seo: SeoMeta;
}

/* ----------------------------------------------------------- destinations */

export interface Destination extends ContentRecord, FeaturedImageSet {
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string;
  country: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  highlights: RichListContent;
  faqs?: TourFaq[];
  bestSeason: string[];
  /** Free text, e.g. "7-14 days". Tour packages carry precise durations. */
  typicalDuration: string | null;
  featured: boolean;
  order: number;
  seo: SeoMeta;
}

/* -------------------------------------------------------------- activities */

export interface Activity extends ContentRecord, FeaturedImageSet {
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  faqs?: TourFaq[];
  order: number;
  seo: SeoMeta;
}

/* ----------------------------------------------------------------- tours */

export const TOUR_DIFFICULTIES = [
  "easy",
  "moderate",
  "challenging",
  "strenuous",
  "extreme",
] as const;

export type TourDifficulty = (typeof TOUR_DIFFICULTIES)[number];

/**
 * Where a night is spent.
 *
 * A vocabulary rather than free text so the frontend can badge a day and a
 * client can filter on it. `other` is deliberate: the list covers what Nepali
 * operators sell and will not cover what the next client sells, and an escape
 * hatch is cheaper than a schema change per booking.
 */
export const ACCOMMODATION_TYPES = [
  "hotel",
  "tea-house",
  "guest-house",
  "lodge",
  "resort",
  "homestay",
  "camping",
  "other",
] as const;

export type AccommodationType = (typeof ACCOMMODATION_TYPES)[number];

/**
 * Types a star rating means anything for.
 *
 * A teahouse in Lobuche is not a two-star hotel; it is a different category of
 * thing. Offering the stars anyway would invite an editor to grade one, and
 * the number would then show on the public site as if it were comparable.
 */
export const RATED_ACCOMMODATION_TYPES = ["hotel", "resort"] as const;

export interface ItineraryDay {
  id: string;
  /**
   * First day this entry covers. Derived from position and the spans before
   * it, never hand-typed — see `spanDays`.
   */
  day: number;
  /**
   * How many consecutive days the entry covers. 1 for an ordinary day, more
   * when one description fills a block: "Days 3-5, acclimatisation at Namche".
   *
   * Stored as a length rather than an end day so reordering cannot produce a
   * gap or an overlap; the editor recomputes every `day` from these on save.
   */
  spanDays: number;
  title: string;
  description: string;
  /** The property's name, e.g. "Hotel Everest View". Free text by design. */
  accommodation: string | null;
  accommodationType: AccommodationType | null;
  /** 1-5, and only where the type is graded. Null everywhere else. */
  accommodationRating: number | null;
  meals: string[];
  activities: string[];
  images: string[];
  /** Metres. Useful for trekking itineraries. */
  altitude: number | null;
  /** Free text, e.g. "5-6 hrs". */
  duration: string | null;
}

/**
 * A per-person rate that applies to a band of party sizes.
 *
 * Trekking is priced this way because most of the cost is fixed: one guide and
 * one permit run set of paperwork cost the same whether two people walk or
 * eight, so the per-head price falls as the party grows. Operators quote it as
 * a table, and clients expect to edit it as one.
 *
 * The rate is **per person**, not a party total. A total is the rate times the
 * head count, which is the arithmetic every customer does in their head, and
 * storing the total instead would make "from $1,490 per person" impossible to
 * derive.
 */
export interface GroupPriceTier {
  id: string;
  /** Smallest party this rate applies to. At least 1. */
  minPeople: number;
  /** Largest party it applies to, or null for "and above". */
  maxPeople: number | null;
  /** Per person, in the tour's currency. */
  price: number;
}

export interface TourFaq {
  id: string;
  question: string;
  answer: string;
  /** Blank for a general question; a name groups related questions. */
  category?: string | null;
}

export interface TourPackage extends ContentRecord, FeaturedImageSet {
  tripInfo?: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string;
  /** Minor units are not used; store the display price. */
  price: number | null;
  /** Optional strike-through price for promotions. */
  compareAtPrice: number | null;
  /**
   * Per-person rates by party size. Empty means one price for everyone, which
   * is `price` above.
   */
  groupPricing: GroupPriceTier[];
  currency: string;
  priceNote: string | null;
  /** Nights/days as integers so tours can be filtered and sorted by length. */
  durationDays: number | null;
  durationNights: number | null;
  difficulty: TourDifficulty | null;
  groupSizeMin: number | null;
  groupSizeMax: number | null;
  maxAltitude: number | null;
  destinationId: ID | null;
  activityIds: ID[];
  itinerary: ItineraryDay[];
  inclusions: RichListContent;
  exclusions: RichListContent;
  highlights: RichListContent;
  faqs: TourFaq[];
  bestSeason: string[];
  featured: boolean;
  order: number;
  seo: SeoMeta;
}

/* ---------------------------------------------------------- testimonials */

export interface Testimonial extends ContentRecord {
  name: string;
  image: string | null;
  /** 1-5. */
  rating: number;
  message: string;
  position: string | null;
  company: string | null;
  country: string | null;
  /** Optional link back to the tour the review is about. */
  tourId: ID | null;
  featured: boolean;
  order: number;
}

/* ------------------------------------------------------------------ faqs */

export interface Faq extends ContentRecord {
  question: string;
  answer: string;
  category: string | null;
  order: number;
}

/* ------------------------------------------------------------ newsletter */

/**
 * A newsletter signup, held until the client picks an email provider.
 *
 * Deliberately minimal: an address, where it came from, and when consent was
 * given. No IP address or user agent — nothing is kept that the export to a
 * provider would not need.
 */
export interface Subscriber extends BaseRecord {
  email: string;
  /** Which form, e.g. "footer". */
  source: string | null;
  /** When the visitor submitted the form: the consent record. */
  consentedAt: string;
}

/* -------------------------------------------------------------- bookings */

export const ENQUIRY_STATUSES = [
  "new",
  "contacted",
  "quoted",
  "converted",
  "closed",
  "spam",
] as const;

export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

export interface Enquiry extends BaseRecord {
  name: string;
  email: string;
  phone: string | null;
  country: string | null;
  message: string;
  /** Which tour/destination the enquiry came from, when known. */
  subjectType: string | null;
  subjectId: ID | null;
  travelDate: string | null;
  travellers: number | null;
  status: EnquiryStatus;
  /** Internal notes, never exposed publicly. */
  notes: string | null;
  source: string | null;
}
