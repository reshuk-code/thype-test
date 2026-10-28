"use client";

import { Save } from "lucide-react";
import { startTransition, useActionState, useRef, useState, type FormEvent } from "react";

import { saveAuthorAction } from "@/app/admin/(dashboard)/authors/actions";
import { ImageField } from "@/components/cms/image-field";
import { SeoFields } from "@/components/cms/seo-fields";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { useFormFeedback } from "@/hooks/use-form-feedback";
import { IDLE } from "@/lib/actions/result";
import { toDateTimeLocal } from "@/lib/utils";
import { slugify } from "@/schemas/common";
import { AUTHOR_LINK_KEYS, type Author, type AuthorLinkKey } from "@/types/content";

const LINK_LABELS: Record<AuthorLinkKey, string> = {
  website: "Website",
  instagram: "Instagram",
  x: "X (Twitter)",
  facebook: "Facebook",
  youtube: "YouTube",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
};

export interface AuthorFormProps {
  author: Author | null;
  /**
   * CMS accounts a profile can be linked to. Empty when the editor may not
   * read the user list, in which case the field is hidden and an existing
   * link is preserved untouched.
   */
  accountOptions: { id: string; name: string }[];
  siteUrl: string;
  basePath: string;
  canPublish: boolean;
}

/**
 * The author profile editor: the page-editor pattern trimmed to what a byline
 * needs. Submits through `onSubmit` for the reason given in `post-form.tsx`.
 */
export function AuthorForm({
  author,
  accountOptions,
  siteUrl,
  basePath,
  canPublish,
}: AuthorFormProps) {
  const [state, formAction, pending] = useActionState(saveAuthorAction, IDLE);

  const [name, setName] = useState(author?.name ?? "");
  const [slugOverride, setSlugOverride] = useState<string | null>(author?.slug ?? null);
  const slug = slugOverride ?? (name ? slugify(name) : "");
  const [bio, setBio] = useState(author?.bio ?? "");
  const [avatar, setAvatar] = useState(author?.avatar ?? "");
  const [status, setStatus] = useState(author?.status ?? "draft");

  const errors = state.fieldErrors ?? {};

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  const formRef = useRef<HTMLFormElement>(null);
  useFormFeedback(state, formRef);

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
      {author ? <input type="hidden" name="id" value={author.id} /> : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-5">
          <Card>
            <CardBody className="space-y-5">
              <Field id="name" label="Name" error={errors.name?.[0]} required>
                {(props) => (
                  <Input
                    {...props}
                    name="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="text-base"
                    required
                  />
                )}
              </Field>

              <Field
                id="slug"
                label="Slug"
                error={errors.slug?.[0]}
                hint={
                  <>
                    Served at{" "}
                    <code className="rounded bg-muted px-1">
                      {siteUrl}
                      {basePath}/{slug || "…"}
                    </code>
                  </>
                }
                required
              >
                {(props) => (
                  <Input
                    {...props}
                    name="slug"
                    value={slug}
                    onChange={(event) => setSlugOverride(event.target.value)}
                    onBlur={(event) =>
                      setSlugOverride(event.target.value ? slugify(event.target.value) : null)
                    }
                    className="font-mono text-xs"
                    required
                  />
                )}
              </Field>

              <Field
                id="jobTitle"
                label="Role"
                error={errors.jobTitle?.[0]}
                hint="Shown under the name, e.g. Contributing editor."
              >
                {(props) => (
                  <Input {...props} name="jobTitle" defaultValue={author?.jobTitle ?? ""} />
                )}
              </Field>

              <Field
                id="bio"
                label="Bio"
                error={errors.bio?.[0]}
                hint="A short paragraph in the third person. Shown on the profile page and under articles."
              >
                {(props) => (
                  <Textarea
                    {...props}
                    name="bio"
                    value={bio}
                    onChange={(event) => setBio(event.target.value)}
                    rows={5}
                  />
                )}
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Links"
              description="Full addresses starting with https://. Blank ones are not shown."
            />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              {AUTHOR_LINK_KEYS.map((key) => (
                <Field
                  key={key}
                  id={`links.${key}`}
                  label={LINK_LABELS[key]}
                  error={errors[`links.${key}`]?.[0]}
                >
                  {(props) => (
                    <Input
                      {...props}
                      name={`links.${key}`}
                      type="url"
                      inputMode="url"
                      defaultValue={author?.links?.[key] ?? ""}
                      placeholder="https://"
                    />
                  )}
                </Field>
              ))}
            </CardBody>
          </Card>

          <SeoFields
            seo={author?.seo ?? null}
            fallbackTitle={name}
            fallbackDescription={bio}
            slug={`${basePath}/${slug}`}
            siteUrl={siteUrl}
            errors={errors}
            featuredImage={avatar || null}
          />
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Publishing" />
            <CardBody className="space-y-4">
              <Field id="status" label="Status" error={errors.status?.[0]}>
                {(props) => (
                  <Select
                    {...props}
                    name="status"
                    value={status}
                    onChange={(event) => setStatus(event.target.value as Author["status"])}
                  >
                    <option value="draft">Draft</option>
                    <option value="published" disabled={!canPublish}>
                      Published
                    </option>
                    <option value="archived">Archived</option>
                    <option value="trash">Trash</option>
                  </Select>
                )}
              </Field>

              <p className="text-xs text-muted-foreground">
                {canPublish
                  ? "A draft profile still credits posts by name; it just has no public page."
                  : "Your role can save drafts but not publish them."}
              </p>

              <input type="hidden" name="publishedAt" value={author?.publishedAt ?? ""} />
              {author?.publishedAt ? (
                <p className="text-xs text-muted-foreground">
                  First published {toDateTimeLocal(author.publishedAt).replace("T", " ")}.
                </p>
              ) : null}

              <Button type="submit" disabled={pending} className="w-full">
                <Save className="size-4" />
                {pending ? "Saving…" : author ? "Save changes" : "Create author"}
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Portrait and account" />
            <CardBody className="space-y-4">
              <ImageField
                id="avatar"
                name="avatar"
                label="Portrait"
                hint="Square works best."
                defaultValue={author?.avatar ?? ""}
                onValueChange={setAvatar}
              />

              {accountOptions.length > 0 ? (
                <Field
                  id="userId"
                  label="CMS account"
                  error={errors.userId?.[0]}
                  hint="Optional. New posts by this account default to this byline. Never shown publicly."
                >
                  {(props) => (
                    <Select {...props} name="userId" defaultValue={author?.userId ?? ""}>
                      <option value="">Not linked (guest writer)</option>
                      {accountOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              ) : author?.userId ? (
                <input type="hidden" name="userId" value={author.userId} />
              ) : null}
            </CardBody>
          </Card>
        </div>
      </div>
    </form>
  );
}
