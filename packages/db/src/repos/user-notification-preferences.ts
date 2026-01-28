import type { UserNotificationPreferences as UserNotificationPreferencesData } from "@domainstack/types";
import { eq } from "drizzle-orm";
import { userNotificationPreferences } from "../schema";
import type { DbClient } from "../types";

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

export function createUserNotificationPreferencesRepo(db: DbClient) {
  return {
    /**
     * Get user notification preferences, creating default preferences if they don't exist.
     */
    async getOrCreateUserNotificationPreferences(
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
        throw new Error(
          `Failed to get notification preferences for user ${userId} after upsert`,
        );
      }

      return mapPreferences(row);
    },

    /**
     * Update user notification preferences.
     */
    async updateUserNotificationPreferences(
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
    },

    /**
     * Get notification preferences for a user (returns null if not found).
     */
    async getUserNotificationPreferences(
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
    },
  };
}

export type UserNotificationPreferencesRepo = ReturnType<
  typeof createUserNotificationPreferencesRepo
>;
