-- Step 1: Drop the old constraint (allows duplicates with NULL priority)
ALTER TABLE "dns_records" DROP CONSTRAINT "u_dns_record";--> statement-breakpoint

-- Step 2: Delete duplicate DNS records, keeping only the most recently fetched one
-- This is needed because the old constraint allowed duplicates when priority IS NULL
DELETE FROM dns_records a
USING dns_records b
WHERE a.id < b.id
  AND a.domain_id = b.domain_id
  AND a.type = b.type
  AND a.name = b.name
  AND a.value = b.value
  AND a.priority IS NOT DISTINCT FROM b.priority;--> statement-breakpoint

-- Step 3: Create the new constraint with NULLS NOT DISTINCT (treats NULL = NULL)
ALTER TABLE "dns_records" ADD CONSTRAINT "u_dns_record" UNIQUE NULLS NOT DISTINCT("domain_id","type","name","value","priority");
