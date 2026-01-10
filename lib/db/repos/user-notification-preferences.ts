import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { userNotificationPreferences } from "@/lib/db/schema";
import type { UserNotificationPreferences as UserNotificationPreferencesData } from "@/lib/types/notifications";

function mapPreferences(
  row: typeof userNotificationPreferences.$inferSelect,
): UserNotificationPreferencesData {
  return {
    domainExpiry: row.domainExpiry,
    certificateExpiry: row.certificateExpiry,
    registrationChanges: row.registrationChanges,
    providerChanges: row.providerChanges,
    certificateChanges: row.certificateChanges,
  };
}

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
    return mapPreferences(existing[0]);
  }

  // Create default preferences
  const inserted = await db
    .insert(userNotificationPreferences)
    .values({
      userId,
      domainExpiry: { inApp: true, email: true },
      certificateExpiry: { inApp: true, email: true },
      registrationChanges: { inApp: true, email: true },
      providerChanges: { inApp: true, email: true },
      certificateChanges: { inApp: true, email: true },
    })
    .returning();

  return mapPreferences(inserted[0]);
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

  return mapPreferences(updated[0]);
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

  return mapPreferences(rows[0]);
}
