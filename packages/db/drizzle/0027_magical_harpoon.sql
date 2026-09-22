ALTER TABLE "dnssec_checks" ADD COLUMN "ds_available" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "dnssec_checks" ADD COLUMN "dnskeys_available" boolean DEFAULT true NOT NULL;