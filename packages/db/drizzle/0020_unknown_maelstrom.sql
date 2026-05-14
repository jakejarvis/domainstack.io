CREATE TABLE "push_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" text NOT NULL,
	"expo_push_token" text NOT NULL,
	"notification_id" uuid,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"error_code" text,
	CONSTRAINT "u_push_receipts_ticket" UNIQUE("ticket_id")
);
--> statement-breakpoint
ALTER TABLE "push_receipts" ADD CONSTRAINT "push_receipts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_push_receipts_pending" ON "push_receipts" USING btree ("processed_at","created_at");