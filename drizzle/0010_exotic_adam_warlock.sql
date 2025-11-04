DROP TABLE "registration_nameservers" CASCADE;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "nameservers" jsonb DEFAULT '[]'::jsonb NOT NULL;