CREATE TABLE "domain_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tracked_domain_id" uuid NOT NULL,
	"registration" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"dns_provider_id" uuid,
	"hosting_provider_id" uuid,
	"email_provider_id" uuid,
	"certificate" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "domain_snapshots_tracked_domain_id_unique" UNIQUE("tracked_domain_id")
);
--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ADD COLUMN "registration_changes" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ADD COLUMN "provider_changes" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ADD COLUMN "certificate_changes" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "domain_snapshots" ADD CONSTRAINT "domain_snapshots_tracked_domain_id_user_tracked_domains_id_fk" FOREIGN KEY ("tracked_domain_id") REFERENCES "public"."user_tracked_domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_snapshots" ADD CONSTRAINT "domain_snapshots_dns_provider_id_providers_id_fk" FOREIGN KEY ("dns_provider_id") REFERENCES "public"."providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_snapshots" ADD CONSTRAINT "domain_snapshots_hosting_provider_id_providers_id_fk" FOREIGN KEY ("hosting_provider_id") REFERENCES "public"."providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_snapshots" ADD CONSTRAINT "domain_snapshots_email_provider_id_providers_id_fk" FOREIGN KEY ("email_provider_id") REFERENCES "public"."providers"("id") ON DELETE no action ON UPDATE no action;