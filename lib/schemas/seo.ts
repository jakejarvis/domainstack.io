import { z } from "zod";

export const RobotsRuleSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("allow"), value: z.string() }),
  z.object({ type: z.literal("disallow"), value: z.string() }),
  z.object({ type: z.literal("crawlDelay"), value: z.string() }),
]);

export const RobotsGroupSchema = z.object({
  userAgents: z.array(z.string()),
  rules: z.array(RobotsRuleSchema),
});

export const RobotsTxtSchema = z.object({
  fetched: z.boolean(),
  groups: z.array(RobotsGroupSchema),
  sitemaps: z.array(z.string()),
});

export const OpenGraphMetaSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  type: z.string().optional(),
  url: z.string().url().optional(),
  siteName: z.string().optional(),
  images: z.array(z.string().url()),
});

export const TwitterMetaSchema = z.object({
  card: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  image: z.string().url().optional(),
});

export const GeneralMetaSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  canonical: z.string().url().optional(),
  robots: z.string().optional(),
});

export const SeoMetaSchema = z.object({
  openGraph: OpenGraphMetaSchema,
  twitter: TwitterMetaSchema,
  general: GeneralMetaSchema,
});

export const SeoPreviewSchema = z.object({
  title: z.string().nullable(),
  description: z.string().nullable(),
  image: z.string().url().nullable(),
  canonicalUrl: z.string().url(),
});

export const SeoResponseSchema = z.object({
  meta: SeoMetaSchema.nullable(),
  robots: RobotsTxtSchema.nullable(),
  preview: SeoPreviewSchema.nullable(),
  source: z.object({
    finalUrl: z.string().url().nullable(),
    status: z.number().nullable(),
  }),
  errors: z
    .object({ html: z.string().optional(), robots: z.string().optional() })
    .partial()
    .optional(),
});

export type SeoResponse = z.infer<typeof SeoResponseSchema>;
