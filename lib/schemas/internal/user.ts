import { z } from "zod";

/**
 * User subscription tier.
 * - "free": Default tier with limited domain tracking
 * - "pro": Paid tier with expanded limits
 */
export const UserTierSchema = z.enum(["free", "pro"]);

export type UserTier = z.infer<typeof UserTierSchema>;
