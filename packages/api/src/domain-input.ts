import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { toRegistrableDomain } from "@domainstack/utils/domain";

/** `{ domain }` input, normalized to its registrable domain (`www.Example.com` → `example.com`). */
export const DomainInputSchema = z.object({ domain: z.string().min(1) }).transform(({ domain }) => {
  const registrable = toRegistrableDomain(domain);
  if (!registrable) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Enter a valid domain name, like example.com.",
    });
  }
  return { domain: registrable };
});
