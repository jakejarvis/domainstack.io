-- Migrate existing boolean columns to JSONB structure preserving user preferences
-- Step 1: Convert existing columns to JSONB, combining email and inApp preferences
ALTER TABLE "user_notification_preferences" ADD COLUMN "domain_expiry_new" jsonb;--> statement-breakpoint
UPDATE "user_notification_preferences" SET "domain_expiry_new" = jsonb_build_object('email', "domain_expiry", 'inApp', COALESCE("domain_expiry_in_app", true));--> statement-breakpoint
ALTER TABLE "user_notification_preferences" DROP COLUMN "domain_expiry";--> statement-breakpoint
ALTER TABLE "user_notification_preferences" DROP COLUMN "domain_expiry_in_app";--> statement-breakpoint
ALTER TABLE "user_notification_preferences" RENAME COLUMN "domain_expiry_new" TO "domain_expiry";--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ALTER COLUMN "domain_expiry" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ALTER COLUMN "domain_expiry" SET DEFAULT '{"inApp": true, "email": true}'::jsonb;--> statement-breakpoint

ALTER TABLE "user_notification_preferences" ADD COLUMN "certificate_expiry_new" jsonb;--> statement-breakpoint
UPDATE "user_notification_preferences" SET "certificate_expiry_new" = jsonb_build_object('email', "certificate_expiry", 'inApp', COALESCE("certificate_expiry_in_app", true));--> statement-breakpoint
ALTER TABLE "user_notification_preferences" DROP COLUMN "certificate_expiry";--> statement-breakpoint
ALTER TABLE "user_notification_preferences" DROP COLUMN "certificate_expiry_in_app";--> statement-breakpoint
ALTER TABLE "user_notification_preferences" RENAME COLUMN "certificate_expiry_new" TO "certificate_expiry";--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ALTER COLUMN "certificate_expiry" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ALTER COLUMN "certificate_expiry" SET DEFAULT '{"inApp": true, "email": true}'::jsonb;--> statement-breakpoint

ALTER TABLE "user_notification_preferences" ADD COLUMN "verification_status_new" jsonb;--> statement-breakpoint
UPDATE "user_notification_preferences" SET "verification_status_new" = jsonb_build_object('email', "verification_status", 'inApp', COALESCE("verification_status_in_app", true));--> statement-breakpoint
ALTER TABLE "user_notification_preferences" DROP COLUMN "verification_status";--> statement-breakpoint
ALTER TABLE "user_notification_preferences" DROP COLUMN "verification_status_in_app";--> statement-breakpoint
ALTER TABLE "user_notification_preferences" RENAME COLUMN "verification_status_new" TO "verification_status";--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ALTER COLUMN "verification_status" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ALTER COLUMN "verification_status" SET DEFAULT '{"inApp": true, "email": true}'::jsonb;--> statement-breakpoint

ALTER TABLE "user_notification_preferences" ADD COLUMN "registration_changes_new" jsonb;--> statement-breakpoint
UPDATE "user_notification_preferences" SET "registration_changes_new" = jsonb_build_object('email', "registration_changes", 'inApp', COALESCE("registration_changes_in_app", true));--> statement-breakpoint
ALTER TABLE "user_notification_preferences" DROP COLUMN "registration_changes";--> statement-breakpoint
ALTER TABLE "user_notification_preferences" DROP COLUMN "registration_changes_in_app";--> statement-breakpoint
ALTER TABLE "user_notification_preferences" RENAME COLUMN "registration_changes_new" TO "registration_changes";--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ALTER COLUMN "registration_changes" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ALTER COLUMN "registration_changes" SET DEFAULT '{"inApp": true, "email": true}'::jsonb;--> statement-breakpoint

ALTER TABLE "user_notification_preferences" ADD COLUMN "provider_changes_new" jsonb;--> statement-breakpoint
UPDATE "user_notification_preferences" SET "provider_changes_new" = jsonb_build_object('email', "provider_changes", 'inApp', COALESCE("provider_changes_in_app", true));--> statement-breakpoint
ALTER TABLE "user_notification_preferences" DROP COLUMN "provider_changes";--> statement-breakpoint
ALTER TABLE "user_notification_preferences" DROP COLUMN "provider_changes_in_app";--> statement-breakpoint
ALTER TABLE "user_notification_preferences" RENAME COLUMN "provider_changes_new" TO "provider_changes";--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ALTER COLUMN "provider_changes" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ALTER COLUMN "provider_changes" SET DEFAULT '{"inApp": true, "email": true}'::jsonb;--> statement-breakpoint

ALTER TABLE "user_notification_preferences" ADD COLUMN "certificate_changes_new" jsonb;--> statement-breakpoint
UPDATE "user_notification_preferences" SET "certificate_changes_new" = jsonb_build_object('email', "certificate_changes", 'inApp', COALESCE("certificate_changes_in_app", true));--> statement-breakpoint
ALTER TABLE "user_notification_preferences" DROP COLUMN "certificate_changes";--> statement-breakpoint
ALTER TABLE "user_notification_preferences" DROP COLUMN "certificate_changes_in_app";--> statement-breakpoint
ALTER TABLE "user_notification_preferences" RENAME COLUMN "certificate_changes_new" TO "certificate_changes";--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ALTER COLUMN "certificate_changes" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ALTER COLUMN "certificate_changes" SET DEFAULT '{"inApp": true, "email": true}'::jsonb;--> statement-breakpoint

-- Migrate notification_overrides in user_tracked_domains to nested structure
-- Convert flat boolean fields to nested objects with inApp and email properties
UPDATE "user_tracked_domains"
SET "notification_overrides" = (
  SELECT jsonb_object_agg(
    CASE 
      WHEN key LIKE '%InApp' THEN SUBSTRING(key FROM 1 FOR LENGTH(key) - 5)
      ELSE key
    END,
    CASE
      WHEN key LIKE '%InApp' THEN
        COALESCE(
          jsonb_build_object(
            'inApp', value::boolean,
            'email', COALESCE(("notification_overrides"->(SUBSTRING(key FROM 1 FOR LENGTH(key) - 5)))::boolean, true)
          ),
          jsonb_build_object('inApp', value::boolean, 'email', true)
        )
      ELSE
        CASE
          WHEN "notification_overrides"->>(key || 'InApp') IS NOT NULL THEN
            jsonb_build_object(
              'email', value::boolean,
              'inApp', ("notification_overrides"->>(key || 'InApp'))::boolean
            )
          ELSE
            jsonb_build_object('email', value::boolean, 'inApp', true)
        END
    END
  )
  FROM jsonb_each("notification_overrides")
  WHERE NOT key LIKE '%InApp'
)
WHERE jsonb_typeof("notification_overrides") = 'object' 
  AND "notification_overrides" != '{}'::jsonb;
