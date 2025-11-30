import { z } from "zod";

export const SocialPreviewProviderSchema = z.enum([
  "twitter",
  "facebook",
  "linkedin",
  "discord",
  "slack",
]);

export const SocialPreviewVariantSchema = z.enum(["compact", "large"]);

export const RobotsRuleSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("allow"), value: z.string() }),
  z.object({ type: z.literal("disallow"), value: z.string() }),
  z.object({ type: z.literal("crawlDelay"), value: z.string() }),
  z.object({ type: z.literal("contentSignal"), value: z.string() }),
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
  images: z.array(z.string().url()).optional(),
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
  keywords: z.string().optional(),
  author: z.string().optional(),
  canonical: z.string().url().optional(),
  generator: z.string().optional(),
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
  imageUploaded: z.string().url().nullable().optional(),
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

export type SocialPreviewProvider = z.infer<typeof SocialPreviewProviderSchema>;
export type SocialPreviewVariant = z.infer<typeof SocialPreviewVariantSchema>;
export type RobotsRule = z.infer<typeof RobotsRuleSchema>;
export type RobotsGroup = z.infer<typeof RobotsGroupSchema>;
export type RobotsTxt = z.infer<typeof RobotsTxtSchema>;
export type OpenGraphMeta = z.infer<typeof OpenGraphMetaSchema>;
export type TwitterMeta = z.infer<typeof TwitterMetaSchema>;
export type GeneralMeta = z.infer<typeof GeneralMetaSchema>;
export type SeoMeta = z.infer<typeof SeoMetaSchema>;
export type SeoPreview = z.infer<typeof SeoPreviewSchema>;
export type SeoResponse = z.infer<typeof SeoResponseSchema>;
