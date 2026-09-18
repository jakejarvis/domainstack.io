import type { InferInsertModel } from "drizzle-orm";
import { eq } from "drizzle-orm";

import type { TechnologiesResponse } from "@domainstack/types";

import { db } from "../client";
import { domains, technologies as technologiesTable } from "../schema";
import type { CacheResult } from "../types";

type TechnologiesInsert = InferInsertModel<typeof technologiesTable>;

export async function upsertTechnologies(params: TechnologiesInsert) {
  await db.insert(technologiesTable).values(params).onConflictDoUpdate({
    target: technologiesTable.domainId,
    set: params,
  });
}

/**
 * Get cached technology detection for a domain with staleness metadata.
 * Returns data even if expired, with `stale: true`.
 */
export async function getCachedTechnologies(
  domain: string,
): Promise<CacheResult<TechnologiesResponse>> {
  const nowMs = Date.now();

  const [row] = await db
    .select({
      detected: technologiesTable.detected,
      sourceFinalUrl: technologiesTable.sourceFinalUrl,
      sourceStatus: technologiesTable.sourceStatus,
      error: technologiesTable.error,
      fetchedAt: technologiesTable.fetchedAt,
      expiresAt: technologiesTable.expiresAt,
    })
    .from(domains)
    .innerJoin(technologiesTable, eq(technologiesTable.domainId, domains.id))
    .where(eq(domains.name, domain))
    .limit(1);

  if (!row) {
    return { data: null, stale: false, fetchedAt: null, expiresAt: null };
  }

  const { fetchedAt, expiresAt } = row;
  const stale = (expiresAt?.getTime?.() ?? 0) <= nowMs;

  const response: TechnologiesResponse = {
    technologies: row.detected,
    source: { finalUrl: row.sourceFinalUrl ?? null, status: row.sourceStatus ?? null },
    ...(row.error ? { error: row.error } : {}),
  };

  return { data: response, stale, fetchedAt, expiresAt };
}
