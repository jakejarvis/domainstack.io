ALTER TABLE "accounts" ADD COLUMN "issuer" text;--> statement-breakpoint
UPDATE "accounts" SET "issuer" = CASE "provider_id"
  -- local (non-OAuth) identities: better-auth writes these itself
  WHEN 'credential' THEN 'local:credential'
  WHEN 'siwe'       THEN 'local:siwe'
  -- OIDC providers that declare a real issuer
  WHEN 'google'     THEN 'https://accounts.google.com'
  -- plain OAuth2 providers -> synthetic issuer, encodeURIComponent(providerId)
  WHEN 'github'     THEN 'local:oauth:github'
  WHEN 'gitlab'     THEN 'local:oauth:gitlab'
  WHEN 'vercel'     THEN 'local:oauth:vercel'
END
WHERE "issuer" IS NULL;--> statement-breakpoint
DO $$
DECLARE bad text;
BEGIN
  -- 1. every row got an issuer
  SELECT string_agg(DISTINCT "provider_id", ', ')
    INTO bad FROM "accounts" WHERE "issuer" IS NULL;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'accounts.issuer backfill left NULL rows; unmapped provider_id: %', bad;
  END IF;

  -- 2. credential rows must key on the user id (1.7 sign-in looks them up that way)
  SELECT string_agg("id", ', ') INTO bad
  FROM "accounts"
  WHERE "provider_id" = 'credential' AND "account_id" IS DISTINCT FROM "user_id";
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'credential accounts whose account_id is not the user id: %', bad;
  END IF;

  -- 3. no (issuer, account_id) collisions before the unique index
  SELECT string_agg(format('(%s, %s) x%s', i, a, c), '; ') INTO bad
  FROM (
    SELECT "issuer" i, "account_id" a, count(*) c
    FROM "accounts" GROUP BY 1, 2 HAVING count(*) > 1 LIMIT 20
  ) d;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'accounts (issuer, account_id) collisions, resolve before applying unique index: %', bad;
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "issuer" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_issuer_accountId_uidx" ON "accounts" USING btree ("issuer","account_id");
