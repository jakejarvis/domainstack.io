CREATE TYPE "public"."dnssec_status" AS ENUM('secure', 'insecure', 'bogus', 'indeterminate');--> statement-breakpoint
CREATE TABLE "dnssec_checks" (
	"domain_id" uuid PRIMARY KEY NOT NULL,
	"status" "dnssec_status" NOT NULL,
	"ds" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"dnskeys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"resolver" text NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "dnssec" jsonb;--> statement-breakpoint
ALTER TABLE "dnssec_checks" ADD CONSTRAINT "dnssec_checks_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "i_dnssec_checks_expires" ON "dnssec_checks" USING btree ("expires_at");