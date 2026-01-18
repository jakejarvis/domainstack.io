import { z } from "zod";

// Primitive checks (schemas + inferred types)
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

// Recursive rule schema
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

export const RuleSchema: z.ZodType<Rule> = z.lazy(() =>
  z.union([
    z.object({ all: z.array(RuleSchema) }),
    z.object({ any: z.array(RuleSchema) }),
    z.object({ not: RuleSchema }),
    RuleLeafSchema,
  ]),
);
export type Rule = { all: Rule[] } | { any: Rule[] } | { not: Rule } | RuleLeaf;

/**
 * Context passed to rule evaluation.
 * This is internal data built from our own queries - no validation needed.
 */
export interface DetectionContext {
  headers: Record<string, string>;
  mx: string[];
  ns: string[];
  issuer?: string;
  registrar?: string;
}
