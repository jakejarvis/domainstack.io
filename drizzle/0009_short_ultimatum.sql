ALTER TABLE "notifications" DROP CONSTRAINT "u_notification_unique";--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "tracked_domain_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "message" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "data" jsonb;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "read_at" timestamp with time zone;--> statement-breakpoint

-- Backfill user_id from tracked_domains
UPDATE "notifications" n
SET "user_id" = (
  SELECT "user_id"
  FROM "user_tracked_domains" utd
  WHERE utd.id = n.tracked_domain_id
)
WHERE n.tracked_domain_id IS NOT NULL;--> statement-breakpoint

-- Backfill title and message for existing rows (generic placeholder)
UPDATE "notifications"
SET 
  "title" = 'Notification',
  "message" = 'You received a notification of type: ' || "type"
WHERE "title" IS NULL;--> statement-breakpoint

-- Make columns NOT NULL after backfill
ALTER TABLE "notifications" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "title" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "message" SET NOT NULL;--> statement-breakpoint

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_notifications_user_sent" ON "notifications" USING btree ("user_id","sent_at");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_read" ON "notifications" USING btree ("user_id","read_at");