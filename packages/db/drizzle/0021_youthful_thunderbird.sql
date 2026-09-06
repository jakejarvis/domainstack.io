CREATE TABLE "certificate_checks" (
	"domain_id" uuid PRIMARY KEY NOT NULL,
	"valid" boolean NOT NULL,
	"validation_error" text,
	"protocol" text,
	"cipher" text,
	"public_key_bits" integer,
	"chain_complete" boolean NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "certificates" ADD COLUMN "chain_position" integer;--> statement-breakpoint
ALTER TABLE "certificate_checks" ADD CONSTRAINT "certificate_checks_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "i_certificate_checks_expires" ON "certificate_checks" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "i_certs_chain_position" ON "certificates" USING btree ("domain_id","chain_position");