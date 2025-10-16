CREATE TYPE "public"."dns_record_type" AS ENUM('A', 'AAAA', 'MX', 'TXT', 'NS');--> statement-breakpoint
CREATE TYPE "public"."dns_resolver" AS ENUM('cloudflare', 'google');--> statement-breakpoint
CREATE TYPE "public"."provider_category" AS ENUM('hosting', 'email', 'dns', 'ca', 'registrar');--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain_id" uuid NOT NULL,
	"issuer" text NOT NULL,
	"subject" text NOT NULL,
	"alt_names" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_to" timestamp with time zone NOT NULL,
	"ca_provider_id" uuid,
	"fetched_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dns_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain_id" uuid NOT NULL,
	"type" "dns_record_type" NOT NULL,
	"name" text NOT NULL,
	"value" text NOT NULL,
	"ttl" integer,
	"priority" integer,
	"is_cloudflare" boolean,
	"resolver" "dns_resolver" NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "u_dns_record" UNIQUE("domain_id","type","name","value")
);
--> statement-breakpoint
CREATE TABLE "domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"tld" text NOT NULL,
	"punycode_name" text NOT NULL,
	"unicode_name" text NOT NULL,
	"is_idn" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "u_domains_name" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "hosting" (
	"domain_id" uuid PRIMARY KEY NOT NULL,
	"hosting_provider_id" uuid,
	"email_provider_id" uuid,
	"dns_provider_id" uuid,
	"geo_city" text,
	"geo_region" text,
	"geo_country" text,
	"geo_country_code" text,
	"geo_lat" double precision,
	"geo_lon" double precision,
	"fetched_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "http_headers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain_id" uuid NOT NULL,
	"name" text NOT NULL,
	"value" text NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "u_http_header" UNIQUE("domain_id","name")
);
--> statement-breakpoint
CREATE TABLE "provider_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"alias" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" "provider_category" NOT NULL,
	"name" text NOT NULL,
	"domain" text,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registration_nameservers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain_id" uuid NOT NULL,
	"host" text NOT NULL,
	"ipv4" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ipv6" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "u_reg_ns" UNIQUE("domain_id","host")
);
--> statement-breakpoint
CREATE TABLE "registrations" (
	"domain_id" uuid PRIMARY KEY NOT NULL,
	"is_registered" boolean NOT NULL,
	"registry" text,
	"creation_date" timestamp with time zone,
	"updated_date" timestamp with time zone,
	"expiration_date" timestamp with time zone,
	"deletion_date" timestamp with time zone,
	"transfer_lock" boolean,
	"statuses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"contacts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"whois_server" text,
	"rdap_servers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" text NOT NULL,
	"registrar_provider_id" uuid,
	"reseller_provider_id" uuid,
	"fetched_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo" (
	"domain_id" uuid PRIMARY KEY NOT NULL,
	"source_final_url" text,
	"source_status" integer,
	"meta_open_graph" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"meta_twitter" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"meta_general" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"preview_title" text,
	"preview_description" text,
	"preview_image_url" text,
	"preview_image_uploaded_url" text,
	"canonical_url" text,
	"robots" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"robots_sitemaps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_ca_provider_id_providers_id_fk" FOREIGN KEY ("ca_provider_id") REFERENCES "public"."providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dns_records" ADD CONSTRAINT "dns_records_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hosting" ADD CONSTRAINT "hosting_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hosting" ADD CONSTRAINT "hosting_hosting_provider_id_providers_id_fk" FOREIGN KEY ("hosting_provider_id") REFERENCES "public"."providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hosting" ADD CONSTRAINT "hosting_email_provider_id_providers_id_fk" FOREIGN KEY ("email_provider_id") REFERENCES "public"."providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hosting" ADD CONSTRAINT "hosting_dns_provider_id_providers_id_fk" FOREIGN KEY ("dns_provider_id") REFERENCES "public"."providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "http_headers" ADD CONSTRAINT "http_headers_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_aliases" ADD CONSTRAINT "provider_aliases_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_nameservers" ADD CONSTRAINT "registration_nameservers_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_registrar_provider_id_providers_id_fk" FOREIGN KEY ("registrar_provider_id") REFERENCES "public"."providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_reseller_provider_id_providers_id_fk" FOREIGN KEY ("reseller_provider_id") REFERENCES "public"."providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo" ADD CONSTRAINT "seo_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "i_certs_domain" ON "certificates" USING btree ("domain_id");--> statement-breakpoint
CREATE INDEX "i_certs_valid_to" ON "certificates" USING btree ("valid_to");--> statement-breakpoint
CREATE INDEX "i_dns_domain_type" ON "dns_records" USING btree ("domain_id","type");--> statement-breakpoint
CREATE INDEX "i_dns_type_value" ON "dns_records" USING btree ("type","value");--> statement-breakpoint
CREATE INDEX "i_domains_tld" ON "domains" USING btree ("tld");--> statement-breakpoint
CREATE INDEX "i_hosting_providers" ON "hosting" USING btree ("hosting_provider_id","email_provider_id","dns_provider_id");--> statement-breakpoint
CREATE INDEX "i_http_name" ON "http_headers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "i_reg_ns_host" ON "registration_nameservers" USING btree ("host");--> statement-breakpoint
CREATE INDEX "i_reg_registrar" ON "registrations" USING btree ("registrar_provider_id");--> statement-breakpoint
CREATE INDEX "i_reg_expires" ON "registrations" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "i_seo_src_final_url" ON "seo" USING btree ("source_final_url");--> statement-breakpoint
CREATE INDEX "i_seo_canonical" ON "seo" USING btree ("canonical_url");