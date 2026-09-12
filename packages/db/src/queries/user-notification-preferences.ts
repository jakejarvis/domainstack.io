import type { UserNotificationPreferences as UserNotificationPreferencesData } from "@domainstack/types";

import { db } from "../client";
import { userNotificationPreferences } from "../schema";

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

const DEFAULT_PREFERENCES = {
  domainExpiry: { inApp: true, email: true },
  certificateExpiry: { inApp: true, email: true },
  registrationChanges: { inApp: true, email: true },
  providerChanges: { inApp: true, email: true },
  certificateChanges: { inApp: true, email: true },
} as const;

/**
 * Get user notification preferences, creating default preferences if they don't exist.
 */
export async function getOrCreateUserNotificationPreferences(
  userId: string,
): Promise<UserNotificationPreferencesData> {
  const [row] = await db
    .insert(userNotificationPreferences)
    .values({
      userId,
      ...DEFAULT_PREFERENCES,
    })
    .onConflictDoUpdate({
      target: userNotificationPreferences.userId,
      set: { userId },
    })
    .returning();

  if (!row) {
    throw new Error(`Failed to get notification preferences for user ${userId} after upsert`);
  }

  return mapPreferences(row);
}

/**
 * Update user notification preferences.
 */
export async function updateUserNotificationPreferences(
  userId: string,
  preferences: Partial<UserNotificationPreferencesData>,
): Promise<UserNotificationPreferencesData> {
  const [updated] = await db
    .insert(userNotificationPreferences)
    .values({
      userId,
      ...DEFAULT_PREFERENCES,
      ...preferences,
    })
    .onConflictDoUpdate({
      target: userNotificationPreferences.userId,
      set: {
        ...preferences,
        updatedAt: new Date(),
      },
    })
    .returning();

  return mapPreferences(updated);
}
