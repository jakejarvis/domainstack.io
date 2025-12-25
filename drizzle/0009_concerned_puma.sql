ALTER TABLE "notifications" DROP CONSTRAINT "u_notification_unique";--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "tracked_domain_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ALTER COLUMN "domain_expiry" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ALTER COLUMN "domain_expiry" SET DEFAULT '{"inApp": true, "email": true}'::jsonb;--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ALTER COLUMN "certificate_expiry" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ALTER COLUMN "certificate_expiry" SET DEFAULT '{"inApp": true, "email": true}'::jsonb;--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ALTER COLUMN "registration_changes" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ALTER COLUMN "registration_changes" SET DEFAULT '{"inApp": true, "email": true}'::jsonb;--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ALTER COLUMN "provider_changes" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ALTER COLUMN "provider_changes" SET DEFAULT '{"inApp": true, "email": true}'::jsonb;--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ALTER COLUMN "certificate_changes" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ALTER COLUMN "certificate_changes" SET DEFAULT '{"inApp": true, "email": true}'::jsonb;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "user_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "title" text NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "message" text NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "data" jsonb;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "channels" jsonb DEFAULT '["in-app", "email"]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "read_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_notifications_user_sent" ON "notifications" USING btree ("user_id","sent_at");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_read" ON "notifications" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "idx_notifications_channels" ON "notifications" USING gin ("channels");--> statement-breakpoint
ALTER TABLE "user_notification_preferences" DROP COLUMN "verification_status";--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "ck_notifications_channels" CHECK ("notifications"."channels" <@ '["in-app","email"]'::jsonb);