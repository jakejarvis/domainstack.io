CREATE TYPE "public"."user_tier" AS ENUM('free', 'pro');--> statement-breakpoint
CREATE TYPE "public"."verification_method" AS ENUM('dns_txt', 'html_file', 'meta_tag');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('verified', 'failing', 'unverified');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tracked_domain_id" uuid NOT NULL,
	"type" text NOT NULL,
	"sent_at" timestamp with time zone NOT NULL,
	"resend_id" text,
	CONSTRAINT "u_notification_unique" UNIQUE("tracked_domain_id","type")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user_notification_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"domain_expiry" boolean DEFAULT true NOT NULL,
	"certificate_expiry" boolean DEFAULT true NOT NULL,
	"verification_status" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"tier" "user_tier" DEFAULT 'free' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_tracked_domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"domain_id" uuid NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"verification_method" "verification_method",
	"verification_token" text NOT NULL,
	"verification_status" "verification_status" DEFAULT 'unverified' NOT NULL,
	"verification_failed_at" timestamp with time zone,
	"last_verified_at" timestamp with time zone,
	"notification_overrides" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	CONSTRAINT "u_tracked_domain_user" UNIQUE("user_id","domain_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tracked_domain_id_user_tracked_domains_id_fk" FOREIGN KEY ("tracked_domain_id") REFERENCES "public"."user_tracked_domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ADD CONSTRAINT "user_notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tracked_domains" ADD CONSTRAINT "user_tracked_domains_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tracked_domains" ADD CONSTRAINT "user_tracked_domains_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_userId_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "i_notifications_tracked_domain" ON "notifications" USING btree ("tracked_domain_id");--> statement-breakpoint
CREATE INDEX "sessions_userId_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "i_tracked_domains_user" ON "user_tracked_domains" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "i_tracked_domains_domain" ON "user_tracked_domains" USING btree ("domain_id");--> statement-breakpoint
CREATE INDEX "i_tracked_domains_verified" ON "user_tracked_domains" USING btree ("verified");--> statement-breakpoint
CREATE INDEX "i_tracked_domains_status" ON "user_tracked_domains" USING btree ("verification_status");--> statement-breakpoint
CREATE INDEX "i_tracked_domains_archived" ON "user_tracked_domains" USING btree ("archived_at");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");