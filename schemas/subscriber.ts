import { z } from "zod";

/** What an anonymous visitor may submit to the newsletter form. Nothing more. */
export const subscriberInputSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .pipe(z.email("Enter a valid email address.")),
  source: z
    .string()
    .trim()
    .max(40)
    .regex(/^[a-z0-9-]*$/, "Invalid source.")
    .default("footer"),
});

export type SubscriberInput = z.output<typeof subscriberInputSchema>;
