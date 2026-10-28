import type { Metadata } from "next";

import { RichText } from "@/components/frontend/rich-text";
import { Breadcrumbs } from "@/components/frontend/thype/breadcrumbs";
import { ContactForm } from "@/components/frontend/thype/contact-form";
import { cms } from "@/lib/cms";
import { RICH_TEXT_BLOCK } from "@/lib/cms/blocks";
import { generateCmsMetadata } from "@/lib/seo/metadata";

/**
 * Contact. The heading, intro and any extra text are the CMS page with the
 * slug "/contact"; the form is the developer's. Contact details shown here
 * come only from Site settings, so nothing about the client is hardcoded.
 * Messages land in Enquiries in the admin.
 */
export async function generateMetadata(): Promise<Metadata> {
  const [managed, site] = await Promise.all([cms.pages.getBySlug("/contact"), cms.settings.get()]);

  return generateCmsMetadata({
    title: managed?.title ?? `Contact ${site.siteName}`,
    path: "/contact",
    description: managed?.excerpt ?? null,
    image: managed?.featuredImage ?? null,
    seo: managed?.seo ?? null,
  });
}

export default async function ContactPage() {
  const [managed, site] = await Promise.all([cms.pages.getBySlug("/contact"), cms.settings.get()]);

  const body = managed?.body.find((block) => block.type === RICH_TEXT_BLOCK);
  const bodyText = typeof body?.props.content === "string" ? body.props.content : "";

  return (
    <div className="mx-auto w-full max-w-[71.75rem] px-4 pb-20 pt-8 sm:px-6 xl:px-0">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Contact" }]} siteUrl={site.siteUrl} />

      <div className="mt-8 grid gap-14 lg:grid-cols-[minmax(0,40rem)_22rem] lg:justify-between">
        <div>
          <h1 className="font-serif text-[2rem] font-bold leading-tight text-ink sm:text-[2.5rem]">
            {managed?.title ?? "Contact"}
          </h1>
          {managed?.excerpt ? <p className="mt-4 text-lg text-body">{managed.excerpt}</p> : null}
          {bodyText ? (
            <div className="thype-prose mt-6">
              <RichText content={bodyText} />
            </div>
          ) : null}
          <div className="mt-10">
            <ContactForm />
          </div>
        </div>

        {site.contact.email || site.contact.phone || site.contact.address ? (
          <aside className="h-fit bg-sage p-6 text-base">
            <h2 className="font-label text-[0.9375rem] font-bold uppercase text-ink">Reach us directly</h2>
            <ul className="mt-4 space-y-2">
              {site.contact.email ? (
                <li>
                  <a href={`mailto:${site.contact.email}`} className="text-bronze-strong underline underline-offset-4">
                    {site.contact.email}
                  </a>
                </li>
              ) : null}
              {site.contact.phone ? (
                <li>
                  <a href={`tel:${site.contact.phone.replace(/\s+/g, "")}`} className="text-bronze-strong underline underline-offset-4">
                    {site.contact.phone}
                  </a>
                </li>
              ) : null}
              {site.contact.address ? <li className="whitespace-pre-line">{site.contact.address}</li> : null}
            </ul>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
