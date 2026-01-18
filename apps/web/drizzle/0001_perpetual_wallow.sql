CREATE TABLE "favicons" (
	"domain_id" uuid PRIMARY KEY NOT NULL,
	"url" text,
	"pathname" text,
	"size" integer NOT NULL,
	"source" text,
	"not_found" boolean DEFAULT false NOT NULL,
	"upstream_status" integer,
	"upstream_content_type" text,
	"fetched_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "screenshots" (
	"domain_id" uuid PRIMARY KEY NOT NULL,
	"url" text,
	"pathname" text,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"source" text,
	"not_found" boolean DEFAULT false NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "favicons" ADD CONSTRAINT "favicons_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screenshots" ADD CONSTRAINT "screenshots_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "i_favicons_expires" ON "favicons" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "i_screenshots_expires" ON "screenshots" USING btree ("expires_at");