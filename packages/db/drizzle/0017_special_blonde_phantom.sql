DROP INDEX "i_calendar_feeds_token";--> statement-breakpoint
DROP INDEX "i_tracked_domains_archived";--> statement-breakpoint
DROP INDEX "verifications_identifier_idx";--> statement-breakpoint
ALTER TABLE "seo" ALTER COLUMN "errors" SET DEFAULT '{}'::jsonb;--> statement-breakpoint
CREATE INDEX "idx_notifications_tracked_domain" ON "notifications" USING btree ("tracked_domain_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_tracked_domain_type" ON "notifications" USING btree ("tracked_domain_id","type");--> statement-breakpoint
CREATE INDEX "i_reg_expiration_date" ON "registrations" USING btree ("expiration_date");--> statement-breakpoint
CREATE INDEX "i_seo_expires" ON "seo" USING btree ("expires_at");