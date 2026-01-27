import "server-only";

import type { UserNotificationPreferences as UserNotificationPreferencesData } from "@domainstack/types";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { userNotificationPreferences } from "@/lib/db/schema";

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
 * Uses atomic upsert with RETURNING to handle the get-or-create pattern in a single
 * query, reducing from 2 round trips to 1.
 *
 * Optimized: Uses onConflictDoUpdate with a no-op SET to return the existing row
 * when it already exists, avoiding a separate SELECT query.
 */
export async function getOrCreateUserNotificationPreferences(
  userId: string,
): Promise<UserNotificationPreferencesData> {
  // Atomic upsert with RETURNING: insert if not exists, or return existing row
  // The onConflictDoUpdate with set: { userId } is a no-op that allows RETURNING to work
  const [row] = await db
    .insert(userNotificationPreferences)
    .values({
      userId,
      ...DEFAULT_PREFERENCES,
    })
    .onConflictDoUpdate({
      target: userNotificationPreferences.userId,
      // No-op update to allow RETURNING to work for existing rows
      set: { userId },
    })
    .returning();

  if (!row) {
    throw new Error(
      `Failed to get notification preferences for user ${userId} after upsert`,
    );
  }

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
