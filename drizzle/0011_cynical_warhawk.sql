CREATE TABLE "blocked_domains" (
	"domain" text PRIMARY KEY NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
