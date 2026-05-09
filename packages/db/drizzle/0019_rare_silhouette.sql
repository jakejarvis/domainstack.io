CREATE TABLE "user_push_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"expo_push_token" text NOT NULL,
	"platform" text NOT NULL,
	"device_name" text,
	"app_version" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_success_at" timestamp with time zone,
	"last_error_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "u_user_push_devices_token" UNIQUE("expo_push_token"),
	CONSTRAINT "ck_user_push_devices_platform" CHECK ("user_push_devices"."platform" in ('ios', 'android'))
);
--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT "ck_notifications_channels";--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ALTER COLUMN "domain_expiry" SET DEFAULT '{"inApp": true, "email": true, "push": true}'::jsonb;--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ALTER COLUMN "certificate_expiry" SET DEFAULT '{"inApp": true, "email": true, "push": true}'::jsonb;--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ALTER COLUMN "registration_changes" SET DEFAULT '{"inApp": true, "email": true, "push": true}'::jsonb;--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ALTER COLUMN "provider_changes" SET DEFAULT '{"inApp": true, "email": true, "push": true}'::jsonb;--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ALTER COLUMN "certificate_changes" SET DEFAULT '{"inApp": true, "email": true, "push": true}'::jsonb;--> statement-breakpoint
UPDATE "user_notification_preferences" SET
	"domain_expiry" = "domain_expiry" || '{"push": true}'::jsonb,
	"certificate_expiry" = "certificate_expiry" || '{"push": true}'::jsonb,
	"registration_changes" = "registration_changes" || '{"push": true}'::jsonb,
	"provider_changes" = "provider_changes" || '{"push": true}'::jsonb,
	"certificate_changes" = "certificate_changes" || '{"push": true}'::jsonb;--> statement-breakpoint
ALTER TABLE "user_push_devices" ADD CONSTRAINT "user_push_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_user_push_devices_user" ON "user_push_devices" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_push_devices_enabled" ON "user_push_devices" USING btree ("user_id","enabled");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "ck_notifications_channels" CHECK ("notifications"."channels" <@ '["in-app","email","push"]'::jsonb);
