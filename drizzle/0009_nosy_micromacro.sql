DROP INDEX "i_http_domain";--> statement-breakpoint
DROP INDEX "i_http_name";--> statement-breakpoint
ALTER TABLE "http_headers" ADD PRIMARY KEY ("domain_id");--> statement-breakpoint
ALTER TABLE "http_headers" ADD COLUMN "headers" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "http_headers" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "http_headers" DROP COLUMN "name";--> statement-breakpoint
ALTER TABLE "http_headers" DROP COLUMN "value";