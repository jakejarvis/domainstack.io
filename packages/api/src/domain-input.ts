import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { parseDomainTarget, toRegistrableDomain } from "@domainstack/utils/domain";

function invalidDomain(): TRPCError {
  return new TRPCError({
    code: "BAD_REQUEST",
    message: "Enter a valid domain name, like example.com.",
  });
}

/**
 * `{ domain }` input, normalized to its registrable domain
 * (`api.www.Example.com` → `example.com`). For registration and tracking.
 */
export const RegistrableDomainInputSchema = z
  .object({ domain: z.string().min(1) })
  .transform(({ domain }) => {
    const registrable = toRegistrableDomain(domain);
    if (!registrable) throw invalidDomain();
    return { domain: registrable };
  });

/**
 * `{ domain }` input, normalized to the exact hostname (`WWW.Example.com.` →
 * `www.example.com`). It must still sit under a valid registrable domain. For
 * the hostname-scoped report sections (DNS, hosting, TLS, headers, SEO, favicon).
 */
export const HostnameInputSchema = z
  .object({ domain: z.string().min(1) })
  .transform(({ domain }) => {
    const target = parseDomainTarget(domain);
    if (!target) throw invalidDomain();
    return { domain: target.hostname };
  });
