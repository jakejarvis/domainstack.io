import { z } from "zod";

/**
 * User's global notification preferences.
 * All fields are required booleans representing the default for all domains.
 */
export const UserNotificationPreferencesSchema = z.object({
  domainExpiry: z.boolean(),
  certificateExpiry: z.boolean(),
  registrationChanges: z.boolean(),
  providerChanges: z.boolean(),
  certificateChanges: z.boolean(),
});

export type UserNotificationPreferences = z.infer<
  typeof UserNotificationPreferencesSchema
>;

/**
 * Per-domain notification overrides.
 * All fields are optional - undefined means "inherit from global preferences".
 * Setting to true/false explicitly overrides the global setting for that domain.
 */
export const NotificationOverridesSchema = z.object({
  domainExpiry: z.boolean().optional(),
  certificateExpiry: z.boolean().optional(),
  registrationChanges: z.boolean().optional(),
  providerChanges: z.boolean().optional(),
  certificateChanges: z.boolean().optional(),
});

export type NotificationOverrides = z.infer<typeof NotificationOverridesSchema>;

/**
 * Input schema for updating global notification preferences.
 * All fields optional to allow partial updates.
 */
export const UpdateNotificationPreferencesSchema =
  UserNotificationPreferencesSchema.partial();

export type UpdateNotificationPreferences = z.infer<
  typeof UpdateNotificationPreferencesSchema
>;
