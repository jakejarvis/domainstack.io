import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { userNotificationPreferences } from "@/lib/db/schema";
import { createLogger } from "@/lib/logger/server";
import type { UserNotificationPreferences as UserNotificationPreferencesData } from "@/lib/schemas";

const logger = createLogger({ source: "user-notification-preferences" });

// Re-export for convenience
export type { UserNotificationPreferences as UserNotificationPreferencesData } from "@/lib/schemas";

/**
 * Get user notification preferences, creating default preferences if they don't exist.
 */
export async function getOrCreateUserNotificationPreferences(
  userId: string,
): Promise<UserNotificationPreferencesData> {
  const existing = await db
    .select()
    .from(userNotificationPreferences)
    .where(eq(userNotificationPreferences.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    return {
      domainExpiry: existing[0].domainExpiry,
      certificateExpiry: existing[0].certificateExpiry,
      verificationStatus: existing[0].verificationStatus,
    };
  }

  // Create default preferences
  const inserted = await db
    .insert(userNotificationPreferences)
    .values({
      userId,
      domainExpiry: true,
      certificateExpiry: true,
      verificationStatus: true,
    })
    .returning();

  logger.info("created default notification preferences", { userId });

  return {
    domainExpiry: inserted[0].domainExpiry,
    certificateExpiry: inserted[0].certificateExpiry,
    verificationStatus: inserted[0].verificationStatus,
  };
}

/**
 * Update user notification preferences.
 */
export async function updateUserNotificationPreferences(
  userId: string,
  preferences: Partial<UserNotificationPreferencesData>,
): Promise<UserNotificationPreferencesData> {
  // Ensure the record exists first
  await getOrCreateUserNotificationPreferences(userId);

  const updated = await db
    .update(userNotificationPreferences)
    .set({
      ...preferences,
      updatedAt: new Date(),
    })
    .where(eq(userNotificationPreferences.userId, userId))
    .returning();

  logger.info("updated notification preferences", { userId, preferences });

  return {
    domainExpiry: updated[0].domainExpiry,
    certificateExpiry: updated[0].certificateExpiry,
    verificationStatus: updated[0].verificationStatus,
  };
}

/**
 * Get notification preferences for a user (returns null if not found).
 */
export async function getUserNotificationPreferences(
  userId: string,
): Promise<UserNotificationPreferencesData | null> {
  const rows = await db
    .select()
    .from(userNotificationPreferences)
    .where(eq(userNotificationPreferences.userId, userId))
    .limit(1);

  if (rows.length === 0) {
    return null;
  }

  return {
    domainExpiry: rows[0].domainExpiry,
    certificateExpiry: rows[0].certificateExpiry,
    verificationStatus: rows[0].verificationStatus,
  };
}
