"use client";

import Link from "next/link";
import { Plus, Save, Trash2 } from "lucide-react";
import {
  startTransition,
  useActionState,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { saveFooterAction } from "@/app/admin/(dashboard)/settings/footer/actions";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import {
  CheckboxField,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui/field";
import { useFormFeedback } from "@/hooks/use-form-feedback";
import { IDLE } from "@/lib/actions/result";
import type { SiteSettings } from "@/types/settings";

const MAX_COLUMNS = 4;

export interface MenuOption {
  key: string;
  name: string;
}

export function FooterForm({
  footer,
  menus,
  siteName,
  readOnly,
}: {
  footer: SiteSettings["footer"];
  menus: MenuOption[];
  /** Only used to show what the {siteName} token expands to. */
  siteName: string;
  readOnly: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveFooterAction, IDLE);
  const errors = state.fieldErrors ?? {};

  // Rows carry a stable key rather than being addressed by index, so deleting
  // the second of four does not make React reuse another row's DOM state.
  const [columns, setColumns] = useState(() =>
    footer.columns.map((column, index) => ({
      key: `initial-${index}`,
      ...column,
    })),
  );

  const formRef = useRef<HTMLFormElement>(null);
  useFormFeedback(state, formRef);

  function update(key: string, patch: { heading?: string; menuKey?: string }) {
    setColumns((current) =>
      current.map((column) =>
        column.key === key ? { ...column, ...patch } : column,
      ),
    );
  }

  /* See CLAUDE.md, "Form rules": React resets a form whose action prop is a
     function once the action resolves, which would throw away every column on
     a save that failed validation. */
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
            title="About"
            description="The block beside your footer links."
          />
          <CardBody className="space-y-4">
            <Field
              id="blurb"
              label="Short description"
              error={errors.blurb?.[0]}
              hint="Leave blank to use the tagline from Site settings."
            >
              {(props) => (
                <Textarea
                  {...props}
                  name="blurb"
                  rows={3}
                  defaultValue={footer.blurb ?? ""}
                  placeholder="Small-group treks in the Nepal Himalaya, run by the people who grew up there."
                />
              )}
            </Field>

            <CheckboxField
              id="show-contact"
              name="showContact"
              label="Show the contact block"
              defaultChecked={footer.showContact}
              hint="Email, phone and address from Site settings."
            />

            <CheckboxField
              id="show-social"
              name="showSocial"
              label="Show social links"
              defaultChecked={footer.showSocial}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Link columns"
            description="Each column renders a menu. Build the menus under Navigation, so a link is only ever edited in one place."
          />
          <CardBody className="space-y-4">
            {menus.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                You have no menus yet.{" "}
                <Link
                  href="/admin/navigation"
                  className="text-foreground underline underline-offset-4"
                >
                  Create one under Navigation
                </Link>{" "}
                and it will appear here.
              </p>
            ) : null}

            {columns.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No columns yet — the footer falls back to the links built into
                the site until you add one.
              </p>
            ) : null}

            {columns.map((column, index) => (
              <div
                key={column.key}
                className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
              >
                <Field
                  id={`column-heading-${column.key}`}
                  label={`Column ${index + 1} heading`}
                  error={errors[`columns.${index}.heading`]?.[0]}
                >
                  {(props) => (
                    <Input
                      {...props}
                      name="column.heading"
                      value={column.heading}
                      onChange={(event) =>
                        update(column.key, { heading: event.target.value })
                      }
                      placeholder="Explore"
                    />
                  )}
                </Field>

                <Field
                  id={`column-menu-${column.key}`}
                  label="Menu"
                  error={errors[`columns.${index}.menuKey`]?.[0]}
                >
                  {(props) => (
                    <Select
                      {...props}
                      name="column.menuKey"
                      value={column.menuKey}
                      onChange={(event) =>
                        update(column.key, { menuKey: event.target.value })
                      }
                    >
                      <option value="">Choose a menu…</option>
                      {menus.map((menu) => (
                        <option key={menu.key} value={menu.key}>
                          {menu.name}
                        </option>
                      ))}
                      {/*
                        A menu deleted after this column was saved would
                        otherwise vanish from the select, silently re-pointing
                        the column at whichever menu happens to sort first.
                      */}
                      {column.menuKey &&
                      !menus.some((menu) => menu.key === column.menuKey) ? (
                        <option value={column.menuKey}>
                          {column.menuKey} — no longer exists
                        </option>
                      ) : null}
                    </Select>
                  )}
                </Field>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setColumns((current) =>
                      current.filter((item) => item.key !== column.key),
                    )
                  }
                  aria-label={`Remove column ${index + 1}`}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            ))}

            {columns.length < MAX_COLUMNS ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setColumns((current) => [
                    ...current,
                    {
                      key: `column-${Date.now()}-${current.length}`,
                      heading: "",
                      menuKey: "",
                    },
                  ])
                }
              >
                <Plus className="size-4" />
                Add column
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">
                Four columns is the most that fits across the footer.
              </p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Newsletter signup"
            description="The band above the footer. Addresses collected here appear under Newsletter."
          />
          <CardBody className="space-y-4">
            <CheckboxField
              id="newsletter-enabled"
              name="newsletter.enabled"
              label="Show the newsletter signup"
              defaultChecked={footer.newsletter.enabled}
            />
            <Field
              id="newsletter-heading"
              label="Heading"
              error={errors["newsletter.heading"]?.[0]}
            >
              {(props) => (
                <Input
                  {...props}
                  name="newsletter.heading"
                  defaultValue={footer.newsletter.heading ?? ""}
                  placeholder="Latest travel tips"
                />
              )}
            </Field>
            <Field id="newsletter-text" label="Supporting line" error={errors["newsletter.text"]?.[0]}>
              {(props) => (
                <Input
                  {...props}
                  name="newsletter.text"
                  defaultValue={footer.newsletter.text ?? ""}
                  placeholder="Subscribe to get new stories by email."
                />
              )}
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Small print" />
          <CardBody className="space-y-4">
            <Field
              id="copyright"
              label="Copyright line"
              error={errors.copyright?.[0]}
              hint={
                <>
                  <code>{"{year}"}</code> becomes the current year and{" "}
                  <code>{"{siteName}"}</code> becomes {siteName}. Leave it blank
                  for the default line.
                </>
              }
            >
              {(props) => (
                <Input
                  {...props}
                  name="copyright"
                  defaultValue={footer.copyright ?? ""}
                  placeholder="{year} {siteName}. All rights reserved."
                />
              )}
            </Field>

            <Field
              id="legal-note"
              label="Legal note"
              error={errors.legalNote?.[0]}
              hint="Company registration, licence or tax number, if you are required to display one."
            >
              {(props) => (
                <Input
                  {...props}
                  name="legalNote"
                  defaultValue={footer.legalNote ?? ""}
                  placeholder="Registered in Nepal · Tourism licence 1234/567"
                />
              )}
            </Field>
          </CardBody>
        </Card>
      </fieldset>

      {readOnly ? null : (
        <Button type="submit" disabled={pending}>
          <Save className="size-4" />
          {pending ? "Saving…" : "Save footer"}
        </Button>
      )}
    </form>
  );
}
