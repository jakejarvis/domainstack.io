ALTER TABLE "accounts" ADD COLUMN "issuer" text;--> statement-breakpoint
UPDATE "accounts" SET "issuer" = CASE "provider_id"
  WHEN 'google' THEN 'https://accounts.google.com'
  WHEN 'github' THEN 'local:oauth:github'
  WHEN 'gitlab' THEN 'local:oauth:gitlab'
  WHEN 'vercel' THEN 'local:oauth:vercel'
END
WHERE "issuer" IS NULL;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "accounts" WHERE "issuer" IS NULL) THEN
    RAISE EXCEPTION 'accounts.issuer backfill left NULL rows; unknown provider_id values exist';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM "accounts"
    GROUP BY "issuer", "account_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'accounts (issuer, account_id) collisions exist; resolve before applying unique index';
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "issuer" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_issuer_accountId_uidx" ON "accounts" USING btree ("issuer","account_id");
