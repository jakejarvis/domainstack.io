CREATE TABLE "dns_checks" (
	"domain_id" uuid PRIMARY KEY NOT NULL,
	"resolver" text NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dns_checks" ADD CONSTRAINT "dns_checks_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "i_dns_checks_expires" ON "dns_checks" USING btree ("expires_at");