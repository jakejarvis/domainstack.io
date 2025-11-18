import "server-only";
import type { InferInsertModel } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { registrations } from "@/lib/db/schema";
import {
  RegistrationInsert as RegistrationInsertSchema,
  RegistrationUpdate as RegistrationUpdateSchema,
} from "@/lib/db/zod";
import type { RegistrationNameservers } from "@/lib/schemas";

type RegistrationInsert = InferInsertModel<typeof registrations>;

export async function upsertRegistration(params: RegistrationInsert) {
  const { domainId, nameservers, ...rest } = params;

  // Normalize nameserver hosts (trim + lowercase)
  const normalizedNameservers: RegistrationNameservers = (
    nameservers ?? []
  ).map((n) => ({
    host: n.host.trim().toLowerCase(),
    ipv4: n.ipv4 ?? [],
    ipv6: n.ipv6 ?? [],
  }));

  const insertRow = RegistrationInsertSchema.parse({
    domainId,
    nameservers: normalizedNameservers,
    ...rest,
  });
  const updateRow = RegistrationUpdateSchema.parse({
    nameservers: normalizedNameservers,
    ...rest,
  });

  await db.insert(registrations).values(insertRow).onConflictDoUpdate({
    target: registrations.domainId,
    set: updateRow,
  });
}
