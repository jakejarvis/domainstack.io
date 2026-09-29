import { eq } from "drizzle-orm";

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
 * Get user notification preferences without writing. A missing row means defaults;
 * rows are created by `updateUserNotificationPreferences`.
 */
export async function getUserNotificationPreferences(
  userId: string,
): Promise<UserNotificationPreferencesData> {
  const [row] = await db
    .select()
    .from(userNotificationPreferences)
    .where(eq(userNotificationPreferences.userId, userId))
    .limit(1);

  if (row) {
    return mapPreferences(row);
  }

  return {
    domainExpiry: { ...DEFAULT_PREFERENCES.domainExpiry },
    certificateExpiry: { ...DEFAULT_PREFERENCES.certificateExpiry },
    registrationChanges: { ...DEFAULT_PREFERENCES.registrationChanges },
    providerChanges: { ...DEFAULT_PREFERENCES.providerChanges },
    certificateChanges: { ...DEFAULT_PREFERENCES.certificateChanges },
  };
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
