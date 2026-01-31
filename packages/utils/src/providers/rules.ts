import { z } from "zod";

// Primitive rule schemas
const HeaderEqualsSchema = z.object({
  kind: z.literal("headerEquals"),
  name: z.string(),
  value: z.string(),
});

const HeaderIncludesSchema = z.object({
  kind: z.literal("headerIncludes"),
  name: z.string(),
  substr: z.string(),
});

const HeaderPresentSchema = z.object({
  kind: z.literal("headerPresent"),
  name: z.string(),
});

const MxSuffixSchema = z.object({
  kind: z.literal("mxSuffix"),
  suffix: z.string(),
});

const MxRegexSchema = z.object({
  kind: z.literal("mxRegex"),
  pattern: z.string(),
  flags: z.string().optional(),
});

const NsSuffixSchema = z.object({
  kind: z.literal("nsSuffix"),
  suffix: z.string(),
});

const NsRegexSchema = z.object({
  kind: z.literal("nsRegex"),
  pattern: z.string(),
  flags: z.string().optional(),
});

const IssuerEqualsSchema = z.object({
  kind: z.literal("issuerEquals"),
  value: z.string(),
});

const IssuerIncludesSchema = z.object({
  kind: z.literal("issuerIncludes"),
  substr: z.string(),
});

const RegistrarEqualsSchema = z.object({
  kind: z.literal("registrarEquals"),
  value: z.string(),
});

const RegistrarIncludesSchema = z.object({
  kind: z.literal("registrarIncludes"),
  substr: z.string(),
});

// Leaf rules (no nesting)
const RuleLeafSchema = z.union([
  HeaderEqualsSchema,
  HeaderIncludesSchema,
  HeaderPresentSchema,
  MxSuffixSchema,
  MxRegexSchema,
  NsSuffixSchema,
  NsRegexSchema,
  IssuerEqualsSchema,
  IssuerIncludesSchema,
  RegistrarEqualsSchema,
  RegistrarIncludesSchema,
]);

type RuleLeaf = z.infer<typeof RuleLeafSchema>;

/**
 * A detection rule - either a leaf rule or a logical combinator (all/any/not).
 */
export type Rule = { all: Rule[] } | { any: Rule[] } | { not: Rule } | RuleLeaf;

/**
 * Zod schema for recursive rule validation.
 */
export const RuleSchema: z.ZodType<Rule> = z.lazy(() =>
  z.union([
    z.object({ all: z.array(RuleSchema) }),
    z.object({ any: z.array(RuleSchema) }),
    z.object({ not: RuleSchema }),
    RuleLeafSchema,
  ]),
);

/**
 * Context passed to rule evaluation.
 */
export interface DetectionContext {
  headers: Record<string, string>;
  mx: string[];
  ns: string[];
  issuer?: string;
  registrar?: string;
}

/**
 * Evaluate a detection rule against the provided context.
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
