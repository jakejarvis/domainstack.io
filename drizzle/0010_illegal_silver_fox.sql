ALTER TABLE "user_notification_preferences" ADD COLUMN "domain_expiry_in_app" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ADD COLUMN "certificate_expiry_in_app" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ADD COLUMN "verification_status_in_app" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ADD COLUMN "registration_changes_in_app" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ADD COLUMN "provider_changes_in_app" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ADD COLUMN "certificate_changes_in_app" boolean DEFAULT true NOT NULL;