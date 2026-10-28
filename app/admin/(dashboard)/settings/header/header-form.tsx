"use client";

import { Save } from "lucide-react";
import { startTransition, useActionState, useRef, type FormEvent } from "react";

import { saveHeaderAction } from "@/app/admin/(dashboard)/settings/header/actions";
import { GalleryField } from "@/components/cms/gallery-field";
import { ImageField } from "@/components/cms/image-field";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CheckboxField, Field, Input } from "@/components/ui/field";
import { useFormFeedback } from "@/hooks/use-form-feedback";
import { IDLE } from "@/lib/actions/result";
import type { SiteSettings } from "@/types/settings";

export function HeaderForm({
  header,
  sidebar,
  hasContactDetails,
  readOnly,
}: {
  header: SiteSettings["header"];
  sidebar: SiteSettings["sidebar"];
  /** Drives the hint on "show contact", which does nothing until they are set. */
  hasContactDetails: boolean;
  readOnly: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveHeaderAction, IDLE);
  const errors = state.fieldErrors ?? {};

  const formRef = useRef<HTMLFormElement>(null);
  useFormFeedback(state, formRef);

  /*
   * Dispatched by hand rather than through `<form action={…}>`: React resets a
   * form whose action prop is a function once the action resolves, which would
   * blank an announcement the moment its link failed validation. See CLAUDE.md,
   * "Form rules".
   */
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
      <fieldset disabled={readOnly} className="space-y-5">
        <Card>
          <CardHeader
            title="Announcement bar"
            description="A single line above the header — a seasonal offer, a permit change, a closure."
          />
          <CardBody className="space-y-4">
            <CheckboxField
              id="announcement-enabled"
              name="announcement.enabled"
              label="Show the announcement bar"
              defaultChecked={header.announcement.enabled}
            />

            <Field
              id="announcement-text"
              label="Text"
              error={errors["announcement.text"]?.[0]}
            >
              {(props) => (
                <Input
                  {...props}
                  name="announcement.text"
                  defaultValue={header.announcement.text ?? ""}
                  placeholder="Monsoon departures — 15% off until 30 June"
                />
              )}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="announcement-href"
                label="Link"
                error={errors["announcement.href"]?.[0]}
                hint="A path like /tours, or a full https:// URL."
              >
                {(props) => (
                  <Input
                    {...props}
                    name="announcement.href"
                    defaultValue={header.announcement.href ?? ""}
                    placeholder="/tours"
                  />
                )}
              </Field>

              <Field
                id="announcement-link-label"
                label="Link label"
                error={errors["announcement.linkLabel"]?.[0]}
                hint="Leave blank to make the whole line clickable."
              >
                {(props) => (
                  <Input
                    {...props}
                    name="announcement.linkLabel"
                    defaultValue={header.announcement.linkLabel ?? ""}
                    placeholder="See the trips"
                  />
                )}
              </Field>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Layout" />
          <CardBody className="space-y-4">
            <CheckboxField
              id="sticky"
              name="sticky"
              label="Keep the header visible while scrolling"
              defaultChecked={header.sticky}
            />

            <CheckboxField
              id="show-contact"
              name="showContact"
              label="Show phone and email in the header"
              defaultChecked={header.showContact}
              hint={
                hasContactDetails
                  ? "Shown on wider screens only — there is no room beside the menu button on a phone."
                  : "Add a phone number or email under Site settings first, or this shows nothing."
              }
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Call to action"
            description="The one button in the header. Leave both blank for no button."
          />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field
              id="cta-label"
              label="Button label"
              error={errors["cta.label"]?.[0]}
            >
              {(props) => (
                <Input
                  {...props}
                  name="cta.label"
                  defaultValue={header.cta.label ?? ""}
                  placeholder="Plan my trip"
                />
              )}
            </Field>

            <Field
              id="cta-href"
              label="Button link"
              error={errors["cta.href"]?.[0]}
            >
              {(props) => (
                <Input
                  {...props}
                  name="cta.href"
                  defaultValue={header.cta.href ?? ""}
                  placeholder="/contact"
                />
              )}
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Promo banner"
            description="Artwork beside the logo: a sponsor or an offer. Hidden when no image is set. Around 734 × 91 px."
          />
          <CardBody className="space-y-4">
            <ImageField
              id="promo-image"
              name="promo.image"
              label="Banner image"
              defaultValue={header.promo.image ?? ""}
              error={errors["promo.image"]?.[0]}
            />
            <Field
              id="promo-alt"
              label="What the banner says"
              hint="Read aloud by screen readers in place of the image."
              error={errors["promo.alt"]?.[0]}
            >
              {(props) => (
                <Input {...props} name="promo.alt" defaultValue={header.promo.alt ?? ""} />
              )}
            </Field>
            <Field id="promo-href" label="Banner link" error={errors["promo.href"]?.[0]}>
              {(props) => (
                <Input
                  {...props}
                  name="promo.href"
                  defaultValue={header.promo.href ?? ""}
                  placeholder="https://"
                />
              )}
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Sidebar photos"
            description="The photo grid beside the post list and articles. Leave the heading blank to hide it."
          />
          <CardBody className="space-y-4">
            <Field
              id="sidebar-galleryHeading"
              label="Heading"
              error={errors.galleryHeading?.[0]}
            >
              {(props) => (
                <Input
                  {...props}
                  name="sidebar.galleryHeading"
                  defaultValue={sidebar.galleryHeading ?? ""}
                  placeholder="My last adventure"
                />
              )}
            </Field>
            <GalleryField
              name="sidebar.gallery"
              label="Photos"
              hint="Up to six, in display order."
              defaultValue={sidebar.gallery}
            />
            <Field
              id="sidebar-galleryHref"
              label="Link"
              hint="Optional, e.g. an Instagram profile."
              error={errors.galleryHref?.[0]}
            >
              {(props) => (
                <Input
                  {...props}
                  name="sidebar.galleryHref"
                  defaultValue={sidebar.galleryHref ?? ""}
                  placeholder="https://"
                />
              )}
            </Field>
          </CardBody>
        </Card>
      </fieldset>

      {readOnly ? null : (
        <Button type="submit" disabled={pending}>
          <Save className="size-4" />
          {pending ? "Saving…" : "Save header"}
        </Button>
      )}
    </form>
  );
}
