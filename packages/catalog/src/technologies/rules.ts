import { z } from "zod";

import type { TechnologySignal } from "@domainstack/types";

// ============================================================================
// Leaf rule schemas
// ============================================================================

const HeaderPresentSchema = z.object({
  kind: z.literal("headerPresent"),
  name: z.string(),
});

const HeaderRegexSchema = z.object({
  kind: z.literal("headerRegex"),
  name: z.string(),
  pattern: z.string(),
  flags: z.string().optional(),
  version: z.number().int().optional(),
});

const CookiePresentSchema = z.object({
  kind: z.literal("cookiePresent"),
  name: z.string(),
});

const CookieRegexSchema = z.object({
  kind: z.literal("cookieRegex"),
  name: z.string(),
  pattern: z.string(),
  flags: z.string().optional(),
  version: z.number().int().optional(),
});

const MetaPresentSchema = z.object({
  kind: z.literal("metaPresent"),
  name: z.string(),
});

const MetaRegexSchema = z.object({
  kind: z.literal("metaRegex"),
  name: z.string(),
  pattern: z.string(),
  flags: z.string().optional(),
  version: z.number().int().optional(),
});

const HtmlRegexSchema = z.object({
  kind: z.literal("htmlRegex"),
  pattern: z.string(),
  flags: z.string().optional(),
  version: z.number().int().optional(),
});

const ScriptSrcRegexSchema = z.object({
  kind: z.literal("scriptSrcRegex"),
  pattern: z.string(),
  flags: z.string().optional(),
  version: z.number().int().optional(),
});

const UrlRegexSchema = z.object({
  kind: z.literal("urlRegex"),
  pattern: z.string(),
  flags: z.string().optional(),
});

const DnsTxtRegexSchema = z.object({
  kind: z.literal("dnsTxtRegex"),
  pattern: z.string(),
  flags: z.string().optional(),
  version: z.number().int().optional(),
});

const JsGlobalSchema = z.object({
  kind: z.literal("jsGlobal"),
  path: z.string(),
  pattern: z.string().optional(),
  flags: z.string().optional(),
  version: z.number().int().optional(),
});

const TechRuleLeafSchema = z.union([
  HeaderPresentSchema,
  HeaderRegexSchema,
  CookiePresentSchema,
  CookieRegexSchema,
  MetaPresentSchema,
  MetaRegexSchema,
  HtmlRegexSchema,
  ScriptSrcRegexSchema,
  UrlRegexSchema,
  DnsTxtRegexSchema,
  JsGlobalSchema,
]);

type TechRuleLeaf = z.infer<typeof TechRuleLeafSchema>;

/**
 * A technology detection rule - either a leaf rule or a logical combinator
 * (all/any/not).
 */
export type TechRule = { all: TechRule[] } | { any: TechRule[] } | { not: TechRule } | TechRuleLeaf;

/**
 * Zod schema for recursive rule validation.
 */
export const TechRuleSchema: z.ZodType<TechRule> = z.lazy(() =>
  z.union([
    z.object({ all: z.array(TechRuleSchema) }),
    z.object({ any: z.array(TechRuleSchema) }),
    z.object({ not: TechRuleSchema }),
    TechRuleLeafSchema,
  ]),
);

// ============================================================================
// Detection context
// ============================================================================

/**
 * Everything the matcher can see. Built by the caller — this package stays
 * pure and never fetches or parses anything.
 *
 * All record keys are lowercased by the caller. `js` is always empty today;
 * a future headless-browser probe fills it and `jsGlobal` rules start firing
 * with no other change.
 */
export interface TechDetectionContext {
  /** Final URL after redirects. */
  url: string;
  /** Raw HTML body. May be truncated by the fetcher's size cap. */
  html: string;
  /** Response headers, names lowercased. */
  headers: Record<string, string>;
  /** Cookie name → value, names lowercased. */
  cookies: Record<string, string>;
  /** Meta name/property (lowercased) → every content value seen for it. */
  meta: Record<string, string[]>;
  /** Every `<script src>` value, resolved to absolute URLs where possible. */
  scriptSrc: string[];
  /** TXT record values. */
  dnsTxt: string[];
  /** Reserved for the future browser probe. Always `{}` today. */
  js?: Record<string, string>;
}

// ============================================================================
// Evaluation
// ============================================================================

export interface TechRuleMatch {
  matched: boolean;
  /** First version captured along the satisfied path, if any. */
  version: string | null;
  /** Signal kinds that contributed to the match. Deduplicated, in first-seen order. */
  signals: TechnologySignal[];
}

const NO_MATCH: TechRuleMatch = { matched: false, version: null, signals: [] };

function compileRegex(pattern: string, flags?: string): RegExp | null {
  try {
    return new RegExp(pattern, flags ?? "i");
  } catch {
    return null;
  }
}

function extractVersion(match: RegExpExecArray, versionGroup: number | undefined): string | null {
  if (versionGroup === undefined) return null;
  const captured = match[versionGroup];
  if (captured === undefined) return null;
  const trimmed = captured.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function matchOne(
  pattern: string,
  flags: string | undefined,
  version: number | undefined,
  value: string,
  signal: TechnologySignal,
): TechRuleMatch {
  const re = compileRegex(pattern, flags);
  if (!re) return NO_MATCH;
  const result = re.exec(value);
  if (!result) return NO_MATCH;
  return { matched: true, version: extractVersion(result, version), signals: [signal] };
}

function matchAny(
  pattern: string,
  flags: string | undefined,
  version: number | undefined,
  values: string[],
  signal: TechnologySignal,
): TechRuleMatch {
  const re = compileRegex(pattern, flags);
  if (!re) return NO_MATCH;
  for (const value of values) {
    const result = re.exec(value);
    if (result) {
      return { matched: true, version: extractVersion(result, version), signals: [signal] };
    }
  }
  return NO_MATCH;
}

function dedupeSignals(signals: TechnologySignal[]): TechnologySignal[] {
  return [...new Set(signals)];
}

/**
 * Evaluate a technology detection rule against the provided context.
 */
export function evalTechRule(rule: TechRule, ctx: TechDetectionContext): TechRuleMatch {
  if ("all" in rule) {
    const results = rule.all.map((r) => evalTechRule(r, ctx));
    if (!results.every((r) => r.matched)) return NO_MATCH;
    const version = results.find((r) => r.version !== null)?.version ?? null;
    const signals = dedupeSignals(results.flatMap((r) => r.signals));
    return { matched: true, version, signals };
  }

  if ("any" in rule) {
    for (const r of rule.any) {
      const result = evalTechRule(r, ctx);
      if (result.matched) return result;
    }
    return NO_MATCH;
  }

  if ("not" in rule) {
    const result = evalTechRule(rule.not, ctx);
    return { matched: !result.matched, version: null, signals: [] };
  }

  switch (rule.kind) {
    case "headerPresent": {
      return Object.hasOwn(ctx.headers, rule.name.toLowerCase())
        ? { matched: true, version: null, signals: ["header"] }
        : NO_MATCH;
    }
    case "headerRegex": {
      const key = rule.name.toLowerCase();
      if (!Object.hasOwn(ctx.headers, key)) return NO_MATCH;
      return matchOne(rule.pattern, rule.flags, rule.version, ctx.headers[key], "header");
    }
    case "cookiePresent": {
      return Object.hasOwn(ctx.cookies, rule.name.toLowerCase())
        ? { matched: true, version: null, signals: ["cookie"] }
        : NO_MATCH;
    }
    case "cookieRegex": {
      const key = rule.name.toLowerCase();
      if (!Object.hasOwn(ctx.cookies, key)) return NO_MATCH;
      return matchOne(rule.pattern, rule.flags, rule.version, ctx.cookies[key], "cookie");
    }
    case "metaPresent": {
      return Object.hasOwn(ctx.meta, rule.name.toLowerCase())
        ? { matched: true, version: null, signals: ["meta"] }
        : NO_MATCH;
    }
    case "metaRegex": {
      const key = rule.name.toLowerCase();
      if (!Object.hasOwn(ctx.meta, key)) return NO_MATCH;
      return matchAny(rule.pattern, rule.flags, rule.version, ctx.meta[key], "meta");
    }
    case "htmlRegex": {
      return matchOne(rule.pattern, rule.flags, rule.version, ctx.html, "html");
    }
    case "scriptSrcRegex": {
      return matchAny(rule.pattern, rule.flags, rule.version, ctx.scriptSrc, "scriptSrc");
    }
    case "urlRegex": {
      return matchOne(rule.pattern, rule.flags, undefined, ctx.url, "url");
    }
    case "dnsTxtRegex": {
      return matchAny(rule.pattern, rule.flags, rule.version, ctx.dnsTxt, "dnsTxt");
    }
    case "jsGlobal": {
      const js = ctx.js;
      if (!js || !Object.hasOwn(js, rule.path)) return NO_MATCH;
      const value = js[rule.path];
      if (rule.pattern === undefined) {
        return { matched: true, version: null, signals: ["jsGlobal"] };
      }
      return matchOne(rule.pattern, rule.flags, rule.version, value, "jsGlobal");
    }
  }
}
