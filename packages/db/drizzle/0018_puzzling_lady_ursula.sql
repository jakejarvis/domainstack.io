ALTER TABLE "user_tracked_domains" ADD COLUMN "muted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_tracked_domains" DROP COLUMN "notification_overrides";