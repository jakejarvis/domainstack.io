CREATE TABLE "technologies" (
	"domain_id" uuid PRIMARY KEY NOT NULL,
	"detected" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_final_url" text,
	"source_status" integer,
	"error" text,
	"fetched_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "technologies" ADD CONSTRAINT "technologies_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "i_technologies_expires" ON "technologies" USING btree ("expires_at");