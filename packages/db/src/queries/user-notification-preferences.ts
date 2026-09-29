import { eq } from "drizzle-orm";

import type {
  ChannelToggles,
  UserNotificationPreferences as UserNotificationPreferencesData,
} from "@domainstack/types";

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

const DEFAULT_TOGGLES: ChannelToggles = { inApp: true, email: true };

function defaultPreferences(): UserNotificationPreferencesData {
  return {
    domainExpiry: { ...DEFAULT_TOGGLES },
    certificateExpiry: { ...DEFAULT_TOGGLES },
    registrationChanges: { ...DEFAULT_TOGGLES },
    providerChanges: { ...DEFAULT_TOGGLES },
    certificateChanges: { ...DEFAULT_TOGGLES },
  };
}

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

  return defaultPreferences();
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
      ...defaultPreferences(),
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
