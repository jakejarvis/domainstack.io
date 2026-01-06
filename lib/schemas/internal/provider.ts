import { z } from "zod";
import { DnsRecordSchema } from "../domain/dns";
import { RegistrationContactsSchema } from "../domain/registration";

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

export const ProviderCategorySchema = z.enum([
  "hosting",
  "email",
  "dns",
  "ca",
  "registrar",
]);
export type ProviderCategory = z.infer<typeof ProviderCategorySchema>;

export const ProviderSchema = z.object({
  name: z.string(),
  domain: z.string(),
  rule: RuleSchema,
  category: ProviderCategorySchema,
});
export type Provider = z.infer<typeof ProviderSchema>;

export const ProviderRefSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  name: z.string().nullable(),
  domain: z.string().nullable(),
});
export type ProviderRef = z.infer<typeof ProviderRefSchema>;

export const ProviderInfoSchema = z.object({
  id: z.string().nullable(),
  name: z.string().nullable(),
  domain: z.string().nullable(),
  records: z.array(DnsRecordSchema).optional(),
  // Registrar-specific verification data (WHOIS/RDAP)
  whoisServer: z.string().nullable().optional(),
  rdapServers: z.array(z.string()).nullable().optional(),
  registrationSource: z.enum(["rdap", "whois"]).nullable().optional(),
  transferLock: z.boolean().nullable().optional(),
  registrantInfo: z
    .object({
      privacyEnabled: z.boolean().nullable(),
      contacts: RegistrationContactsSchema.nullable(),
    })
    .optional(),
  // CA-specific verification data
  certificateExpiryDate: z.date().nullable().optional(),
});
export type ProviderInfo = z.infer<typeof ProviderInfoSchema>;
