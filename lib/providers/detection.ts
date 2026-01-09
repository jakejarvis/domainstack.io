import type { Header } from "@/lib/types";
import type { Provider } from "./parser";
import type { DetectionContext, Rule } from "./rules";

/**
 * A context object for header-based detection, pre-calculating values to
 * avoid redundant work in the loop.
 */
interface HeaderDetectionContext {
  headers: Header[];
  headerMap: Map<string, string>;
  headerNames: Set<string>;
}

/**
 * Create a detection context from HTTP headers for efficient rule evaluation.
 */
function createHeaderContext(headers: Header[]): HeaderDetectionContext {
  const headerMap = new Map<string, string>();
  const headerNames = new Set<string>();

  for (const header of headers) {
    const name = header.name.toLowerCase();
    const value = header.value.toLowerCase();
    headerMap.set(name, value);
    headerNames.add(name);
  }

  return { headers, headerMap, headerNames };
}

/**
 * Evaluate a single detection rule against the provided context.
 */
export function evalRule(rule: Rule, ctx: DetectionContext): boolean {
  const get = (name: string) => ctx.headers[name.toLowerCase()];
  const anyDns = (arr: string[], suf: string) =>
    arr.some((h) => h === suf || h.endsWith(`.${suf}`));
  const anyDnsRegex = (arr: string[], pattern: string, flags?: string) => {
    try {
      const re = new RegExp(pattern, flags ?? "i");
      return arr.some((h) => re.test(h));
    } catch {
      return false;
    }
  };

  if ("all" in rule) return rule.all.every((r) => evalRule(r, ctx));
  if ("any" in rule) return rule.any.some((r) => evalRule(r, ctx));
  if ("not" in rule) return !evalRule(rule.not, ctx);

  switch (rule.kind) {
    case "headerEquals": {
      const v = get(rule.name);
      return (
        typeof v === "string" && v.toLowerCase() === rule.value.toLowerCase()
      );
    }
    case "headerIncludes": {
      const v = get(rule.name);
      return (
        typeof v === "string" &&
        v.toLowerCase().includes(rule.substr.toLowerCase())
      );
    }
    case "headerPresent": {
      const key = rule.name.toLowerCase();
      return key in ctx.headers;
    }
    case "mxSuffix": {
      return anyDns(ctx.mx, rule.suffix.toLowerCase());
    }
    case "mxRegex": {
      return anyDnsRegex(ctx.mx, rule.pattern, rule.flags);
    }
    case "nsSuffix": {
      return anyDns(ctx.ns, rule.suffix.toLowerCase());
    }
    case "nsRegex": {
      return anyDnsRegex(ctx.ns, rule.pattern, rule.flags);
    }
    case "issuerEquals": {
      return !!ctx.issuer && ctx.issuer === rule.value.toLowerCase();
    }
    case "issuerIncludes": {
      return !!ctx.issuer?.includes(rule.substr.toLowerCase());
    }
    case "registrarEquals": {
      return !!ctx.registrar && ctx.registrar === rule.value.toLowerCase();
    }
    case "registrarIncludes": {
      return (
        !!ctx.registrar && ctx.registrar.includes(rule.substr.toLowerCase())
      );
    }
  }
}

/**
 * Detect a provider from a list of providers using the provided context.
 * Returns the full CatalogProvider object for upsert, or null if not found.
 */
function detectProviderFromList(
  providers: Provider[],
  headerContext?: HeaderDetectionContext,
  mxHosts?: string[],
  nsHosts?: string[],
  issuer?: string,
  registrar?: string,
): Provider | null {
  const headersObj: Record<string, string> = Object.fromEntries(
    (headerContext?.headers ?? []).map((h) => [
      h.name.toLowerCase(),
      h.value.trim().toLowerCase(),
    ]),
  );
  const ctx: DetectionContext = {
    headers: headersObj,
    mx: (mxHosts ?? []).map((h) => h.toLowerCase().replace(/\.$/, "")),
    ns: (nsHosts ?? []).map((h) => h.toLowerCase().replace(/\.$/, "")),
    issuer,
    registrar,
  };
  for (const provider of providers) {
    if (evalRule(provider.rule, ctx)) {
      return provider;
    }
  }
  return null;
}

// ============================================================================
// Detection functions that accept providers as a parameter
// ============================================================================

/**
 * Detect hosting provider from HTTP headers.
 *
 * @param headers - HTTP response headers
 * @param providers - Hosting provider catalog from Edge Config
 * @returns Matched provider or null
 */
export function detectHostingProvider(
  headers: Header[],
  providers: Provider[],
): Provider | null {
  const context = createHeaderContext(headers);
  return detectProviderFromList(providers, context);
}

/**
 * Detect email provider from MX records.
 *
 * @param mxHosts - MX record hostnames
 * @param providers - Email provider catalog from Edge Config
 * @returns Matched provider or null (falls back to domain extraction if no match)
 */
export function detectEmailProvider(
  mxHosts: string[],
  providers: Provider[],
): Provider | null {
  return detectProviderFromList(providers, undefined, mxHosts);
}

/**
 * Detect DNS provider from NS records.
 *
 * @param nsHosts - NS record hostnames
 * @param providers - DNS provider catalog from Edge Config
 * @returns Matched provider or null
 */
export function detectDnsProvider(
  nsHosts: string[],
  providers: Provider[],
): Provider | null {
  return detectProviderFromList(providers, undefined, undefined, nsHosts);
}

/**
 * Detect registrar provider from registrar name.
 *
 * @param registrarName - Registrar name from WHOIS/RDAP
 * @param providers - Registrar provider catalog from Edge Config
 * @returns Matched provider or null
 */
export function detectRegistrar(
  registrarName: string,
  providers: Provider[],
): Provider | null {
  const name = (registrarName || "").toLowerCase();
  if (!name) return null;
  return detectProviderFromList(
    providers,
    undefined,
    undefined,
    undefined,
    undefined,
    name,
  );
}

/**
 * Detect certificate authority from an issuer string.
 *
 * @param issuer - Certificate issuer string
 * @param providers - CA provider catalog from Edge Config
 * @returns Matched provider or null
 */
export function detectCertificateAuthority(
  issuer: string,
  providers: Provider[],
): Provider | null {
  const name = (issuer || "").toLowerCase();
  if (!name) return null;
  return detectProviderFromList(
    providers,
    undefined,
    undefined,
    undefined,
    name,
  );
}
