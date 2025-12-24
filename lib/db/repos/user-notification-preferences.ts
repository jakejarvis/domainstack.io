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
      domainExpiryInApp: existing[0].domainExpiryInApp,
      certificateExpiry: existing[0].certificateExpiry,
      certificateExpiryInApp: existing[0].certificateExpiryInApp,
      verificationStatus: existing[0].verificationStatus,
      verificationStatusInApp: existing[0].verificationStatusInApp,
      registrationChanges: existing[0].registrationChanges,
      registrationChangesInApp: existing[0].registrationChangesInApp,
      providerChanges: existing[0].providerChanges,
      providerChangesInApp: existing[0].providerChangesInApp,
      certificateChanges: existing[0].certificateChanges,
      certificateChangesInApp: existing[0].certificateChangesInApp,
    };
  }

  // Create default preferences
  const inserted = await db
    .insert(userNotificationPreferences)
    .values({
      userId,
      domainExpiry: true,
      domainExpiryInApp: true,
      certificateExpiry: true,
      certificateExpiryInApp: true,
      verificationStatus: true, // Always true, not exposed in UI
      verificationStatusInApp: true,
      registrationChanges: true,
      registrationChangesInApp: true,
      providerChanges: true,
      providerChangesInApp: true,
      certificateChanges: true,
      certificateChangesInApp: true,
    })
    .returning();

  logger.info("created default notification preferences", { userId });

  return {
    domainExpiry: inserted[0].domainExpiry,
    domainExpiryInApp: inserted[0].domainExpiryInApp,
    certificateExpiry: inserted[0].certificateExpiry,
    certificateExpiryInApp: inserted[0].certificateExpiryInApp,
    verificationStatus: inserted[0].verificationStatus,
    verificationStatusInApp: inserted[0].verificationStatusInApp,
    registrationChanges: inserted[0].registrationChanges,
    registrationChangesInApp: inserted[0].registrationChangesInApp,
    providerChanges: inserted[0].providerChanges,
    providerChangesInApp: inserted[0].providerChangesInApp,
    certificateChanges: inserted[0].certificateChanges,
    certificateChangesInApp: inserted[0].certificateChangesInApp,
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
    domainExpiryInApp: updated[0].domainExpiryInApp,
    certificateExpiry: updated[0].certificateExpiry,
    certificateExpiryInApp: updated[0].certificateExpiryInApp,
    verificationStatus: updated[0].verificationStatus,
    verificationStatusInApp: updated[0].verificationStatusInApp,
    registrationChanges: updated[0].registrationChanges,
    registrationChangesInApp: updated[0].registrationChangesInApp,
    providerChanges: updated[0].providerChanges,
    providerChangesInApp: updated[0].providerChangesInApp,
    certificateChanges: updated[0].certificateChanges,
    certificateChangesInApp: updated[0].certificateChangesInApp,
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
    domainExpiryInApp: rows[0].domainExpiryInApp,
    certificateExpiry: rows[0].certificateExpiry,
    certificateExpiryInApp: rows[0].certificateExpiryInApp,
    verificationStatus: rows[0].verificationStatus,
    verificationStatusInApp: rows[0].verificationStatusInApp,
    registrationChanges: rows[0].registrationChanges,
    registrationChangesInApp: rows[0].registrationChangesInApp,
    providerChanges: rows[0].providerChanges,
    providerChangesInApp: rows[0].providerChangesInApp,
    certificateChanges: rows[0].certificateChanges,
    certificateChangesInApp: rows[0].certificateChangesInApp,
  };
}
