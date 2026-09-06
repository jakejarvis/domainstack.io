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
CREATE INDEX "i_certs_chain_position" ON "certificates" USING btree ("domain_id","chain_position");--> statement-breakpoint
UPDATE "certificates" AS c
SET "chain_position" = ranked.pos
FROM (
	SELECT
		certs.id,
		(
			ROW_NUMBER() OVER (
				PARTITION BY certs.domain_id
				ORDER BY
					CASE
						WHEN lower(certs.subject) = d.name THEN 0
						WHEN lower(certs.subject) = 'www.' || d.name THEN 1
						ELSE 2
					END,
					certs.valid_to ASC,
					certs.id ASC
			) - 1
		)::integer AS pos
	FROM "certificates" AS certs
	INNER JOIN "domains" AS d ON d.id = certs.domain_id
	WHERE certs.chain_position IS NULL
) AS ranked
WHERE c.id = ranked.id;--> statement-breakpoint
INSERT INTO "certificate_checks" (
	"domain_id",
	"valid",
	"validation_error",
	"protocol",
	"cipher",
	"public_key_bits",
	"chain_complete",
	"fetched_at",
	"expires_at"
)
SELECT
	c.domain_id,
	true,
	NULL,
	NULL,
	NULL,
	NULL,
	true,
	MAX(c.fetched_at),
	MAX(c.expires_at)
FROM "certificates" AS c
WHERE NOT EXISTS (
	SELECT 1 FROM "certificate_checks" AS cc WHERE cc.domain_id = c.domain_id
)
GROUP BY c.domain_id;