import { z } from "zod";

// Primitive checks (schemas + inferred types)
export const HeaderEqualsSchema = z.object({
  kind: z.literal("headerEquals"),
  name: z.string(),
  value: z.string(),
});
export type HeaderEquals = z.infer<typeof HeaderEqualsSchema>;

export const HeaderIncludesSchema = z.object({
  kind: z.literal("headerIncludes"),
  name: z.string(),
  substr: z.string(),
});
export type HeaderIncludes = z.infer<typeof HeaderIncludesSchema>;

export const HeaderPresentSchema = z.object({
  kind: z.literal("headerPresent"),
  name: z.string(),
});
export type HeaderPresent = z.infer<typeof HeaderPresentSchema>;

export const MxSuffixSchema = z.object({
  kind: z.literal("mxSuffix"),
  suffix: z.string(),
});
export type MxSuffix = z.infer<typeof MxSuffixSchema>;

export const MxRegexSchema = z.object({
  kind: z.literal("mxRegex"),
  pattern: z.string(),
  flags: z.string().optional(),
});
export type MxRegex = z.infer<typeof MxRegexSchema>;

export const NsSuffixSchema = z.object({
  kind: z.literal("nsSuffix"),
  suffix: z.string(),
});
export type NsSuffix = z.infer<typeof NsSuffixSchema>;

export const NsRegexSchema = z.object({
  kind: z.literal("nsRegex"),
  pattern: z.string(),
  flags: z.string().optional(),
});
export type NsRegex = z.infer<typeof NsRegexSchema>;

export const IssuerEqualsSchema = z.object({
  kind: z.literal("issuerEquals"),
  value: z.string(),
});
export type IssuerEquals = z.infer<typeof IssuerEqualsSchema>;

export const IssuerIncludesSchema = z.object({
  kind: z.literal("issuerIncludes"),
  substr: z.string(),
});
export type IssuerIncludes = z.infer<typeof IssuerIncludesSchema>;

export const RegistrarEqualsSchema = z.object({
  kind: z.literal("registrarEquals"),
  value: z.string(),
});
export type RegistrarEquals = z.infer<typeof RegistrarEqualsSchema>;

export const RegistrarIncludesSchema = z.object({
  kind: z.literal("registrarIncludes"),
  substr: z.string(),
});
export type RegistrarIncludes = z.infer<typeof RegistrarIncludesSchema>;

// Recursive rule schema
export const RuleLeafSchema = z.union([
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

export type RuleLeaf = z.infer<typeof RuleLeafSchema>;
export type Rule = { all: Rule[] } | { any: Rule[] } | { not: Rule } | RuleLeaf;

export const RuleSchema: z.ZodType<Rule> = z.lazy(() =>
  z.union([
    z.object({ all: z.array(RuleSchema) }),
    z.object({ any: z.array(RuleSchema) }),
    z.object({ not: RuleSchema }),
    RuleLeafSchema,
  ]),
);

// What the evaluator receives
export const DetectionContextSchema = z.object({
  headers: z.record(z.string(), z.string()),
  mx: z.array(z.string()),
  ns: z.array(z.string()),
  issuer: z.string().optional(),
  registrar: z.string().optional(),
});
export type DetectionContext = z.infer<typeof DetectionContextSchema>;
