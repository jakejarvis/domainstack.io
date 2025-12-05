ALTER TABLE "tracked_domains" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_limits" ADD COLUMN "subscription_ends_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "i_tracked_domains_archived" ON "tracked_domains" USING btree ("archived_at");