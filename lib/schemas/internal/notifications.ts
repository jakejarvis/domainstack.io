import { z } from "zod";

/**
 * Data for a single notification item displayed in the UI.
 */
export const NotificationDataSchema = z.object({
  id: z.string(),
  trackedDomainId: z.string().nullable(),
  type: z.string(),
  title: z.string(),
  message: z.string(),
  sentAt: z.date(),
  readAt: z.date().nullable(),
});

export type NotificationData = z.infer<typeof NotificationDataSchema>;

/**
 * Notification channels schema - each notification category has separate toggles for in-app and email.
 */
export const NotificationChannelsSchema = z.object({
  inApp: z.boolean(),
  email: z.boolean(),
});

export type NotificationChannels = z.infer<typeof NotificationChannelsSchema>;

/**
 * User's global notification preferences.
 * All fields are required objects with channel booleans representing the default for all domains.
 * Note: Verification notifications are always sent and cannot be disabled.
 */
export const UserNotificationPreferencesSchema = z.object({
  domainExpiry: NotificationChannelsSchema,
  certificateExpiry: NotificationChannelsSchema,
  registrationChanges: NotificationChannelsSchema,
  providerChanges: NotificationChannelsSchema,
  certificateChanges: NotificationChannelsSchema,
});

export type UserNotificationPreferences = z.infer<
  typeof UserNotificationPreferencesSchema
>;

/**
 * Per-domain notification overrides.
 * All fields are optional - undefined means "inherit from global preferences".
 * Setting to an object with channel booleans explicitly overrides the global setting for that domain.
 */
export const NotificationOverridesSchema = z.object({
  domainExpiry: NotificationChannelsSchema.optional(),
  certificateExpiry: NotificationChannelsSchema.optional(),
  registrationChanges: NotificationChannelsSchema.optional(),
  providerChanges: NotificationChannelsSchema.optional(),
  certificateChanges: NotificationChannelsSchema.optional(),
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
