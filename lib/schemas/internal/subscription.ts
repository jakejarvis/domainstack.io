import { z } from "zod";

export const SubscriptionPlanSchema = z.enum(["free", "pro"]);

export const SubscriptionSchema = z.object({
  plan: SubscriptionPlanSchema,
  planQuota: z.number(),
  endsAt: z.date().nullable(),
  activeCount: z.number(),
  archivedCount: z.number(),
  canAddMore: z.boolean(),
});

export type SubscriptionPlan = z.infer<typeof SubscriptionPlanSchema>;
export type Subscription = z.infer<typeof SubscriptionSchema>;
