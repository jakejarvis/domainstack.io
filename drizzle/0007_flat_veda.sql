ALTER TABLE "domains" ADD COLUMN "last_accessed_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "i_domains_last_accessed" ON "domains" USING btree ("last_accessed_at");