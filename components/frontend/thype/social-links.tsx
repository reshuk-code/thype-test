import { SocialIcon, type SocialNetwork } from "@/components/frontend/thype/social-icons";
import { cn } from "@/lib/utils";
import type { SiteSettings } from "@/types/settings";

const LABELS: Record<SocialNetwork, string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  facebook: "Facebook",
  x: "X",
  whatsapp: "WhatsApp",
};

/** Only http(s) links reach an href; settings validation should ensure it, this makes sure. */
function safeUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** A phone number in Settings becomes a wa.me link; digits only. */
function whatsappUrl(phone: string | null): string | null {
  const digits = phone?.replace(/\D/g, "");
  return digits && digits.length >= 7 ? `https://wa.me/${digits}` : null;
}

/** The networks the client filled in, in the design's order. */
export function socialLinks(site: Pick<SiteSettings, "social" | "contact">) {
  const entries: [SocialNetwork, string | null][] = [
    ["instagram", safeUrl(site.social.instagram)],
    ["youtube", safeUrl(site.social.youtube)],
    ["facebook", safeUrl(site.social.facebook)],
    ["x", safeUrl(site.social.twitter)],
    ["whatsapp", whatsappUrl(site.contact.whatsapp)],
  ];
  return entries.filter((entry): entry is [SocialNetwork, string] => entry[1] !== null);
}

export function SocialLinks({
  site,
  className,
  iconClassName,
}: {
  site: Pick<SiteSettings, "social" | "contact">;
  className?: string;
  iconClassName?: string;
}) {
  const links = socialLinks(site);
  if (links.length === 0) return null;

  return (
    <ul className={cn("flex items-center", className)}>
      {links.map(([network, href]) => (
        <li key={network}>
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="flex size-9 items-center justify-center text-ink transition-colors hover:text-bronze-strong"
          >
            <SocialIcon network={network} className={cn("size-[0.95rem]", iconClassName)} />
            <span className="sr-only">{LABELS[network]} (opens in a new tab)</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
