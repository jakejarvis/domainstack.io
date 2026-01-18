import "server-only";

import { downgradeToFree } from "@/lib/db/repos/user-subscription";

/**
 * Handle user downgrade from Pro to Free tier.
 * Archives oldest domains that exceed the free tier limit.
 *
 * @param userId - The user ID (Polar customer ID maps to our user ID)
 * @returns The number of domains that were archived (0 if none)
 */
export async function handleDowngrade(userId: string): Promise<number> {
  return downgradeToFree(userId);
}
