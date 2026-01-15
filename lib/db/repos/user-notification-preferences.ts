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

const DEFAULT_PREFERENCES = {
  domainExpiry: { inApp: true, email: true },
  certificateExpiry: { inApp: true, email: true },
  registrationChanges: { inApp: true, email: true },
  providerChanges: { inApp: true, email: true },
  certificateChanges: { inApp: true, email: true },
} as const;

/**
 * Get user notification preferences, creating default preferences if they don't exist.
 *
 * Uses atomic insert-or-ignore pattern to avoid race conditions when multiple
 * concurrent requests try to create preferences for a new user.
 */
export async function getOrCreateUserNotificationPreferences(
  userId: string,
): Promise<UserNotificationPreferencesData> {
  // Atomic: insert default preferences if not exists (does nothing on conflict)
  await db
    .insert(userNotificationPreferences)
    .values({
      userId,
      ...DEFAULT_PREFERENCES,
    })
    .onConflictDoNothing({ target: userNotificationPreferences.userId });

  // Now guaranteed to exist - fetch and return
  const [row] = await db
    .select()
    .from(userNotificationPreferences)
    .where(eq(userNotificationPreferences.userId, userId))
    .limit(1);

  return mapPreferences(row);
}

/**
 * Update user notification preferences.
 *
 * Uses atomic upsert to handle both creation and update in a single operation,
 * avoiding race conditions between getOrCreate and update.
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
