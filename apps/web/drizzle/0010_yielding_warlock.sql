CREATE TABLE "provider_logos" (
	"provider_id" uuid PRIMARY KEY NOT NULL,
	"url" text,
	"pathname" text,
	"size" integer NOT NULL,
	"source" text,
	"not_found" boolean DEFAULT false NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "provider_logos" ADD CONSTRAINT "provider_logos_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "i_provider_logos_expires" ON "provider_logos" USING btree ("expires_at");