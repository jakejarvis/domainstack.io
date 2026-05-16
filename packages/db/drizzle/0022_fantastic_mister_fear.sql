CREATE TYPE "public"."billing_provider" AS ENUM('polar', 'apple', 'google', 'revenuecat');--> statement-breakpoint
CREATE TYPE "public"."billing_subscription_status" AS ENUM('active', 'canceling', 'expired', 'incomplete');--> statement-breakpoint
CREATE TABLE "billing_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"provider" "billing_provider" NOT NULL,
	"provider_subscription_id" text NOT NULL,
	"external_id" text NOT NULL,
	"product_id" text,
	"status" "billing_subscription_status" NOT NULL,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "u_billing_sub_provider_external" UNIQUE("provider","external_id")
);
--> statement-breakpoint
ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "i_billing_sub_user" ON "billing_subscriptions" USING btree ("user_id");--> statement-breakpoint
-- Backfill: synthesize a Polar billing_subscriptions row for every currently
-- pro user so the first post-deploy recomputeEntitlement does not downgrade
-- them. external_id == user_id (Polar customer.externalId mapping). The
-- 'backfill:' sentinel provider_subscription_id is overwritten by the next
-- real webhook/reconcile. Idempotent via ON CONFLICT DO NOTHING.
INSERT INTO "billing_subscriptions"
	("user_id", "provider", "provider_subscription_id", "external_id",
	 "product_id", "status", "current_period_end", "cancel_at_period_end")
SELECT
	us."user_id",
	'polar',
	'backfill:' || us."user_id",
	us."user_id",
	NULL,
	CASE WHEN us."ends_at" IS NOT NULL THEN 'canceling' ELSE 'active' END,
	us."ends_at",
	(us."ends_at" IS NOT NULL)
FROM "user_subscriptions" us
WHERE us."tier" = 'pro'
ON CONFLICT ("provider", "external_id") DO NOTHING;