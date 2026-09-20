import { isValidDomain } from "@domainstack/utils/domain/client";

const PROMPT_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

export function formatPromptDate(now: Date = new Date()): string {
  return PROMPT_DATE_FORMATTER.format(now);
}

export function domainContext(domain?: string): string {
  return domain
    ? `The user is viewing ${domain}. Use this as the default when they say "this domain" or don't specify another.`
    : "If no domain is specified, ask which one to look up.";
}

/** Drops domains that fail validation so they never reach a prompt. */
export function sanitizeDomain(domain?: string): string | undefined {
  return domain && isValidDomain(domain) ? domain : undefined;
}

function buildOnDeviceSystemPrompt(domain: string | undefined, today: string): string {
  return `You are Stacky, a domain intelligence assistant. You look up DNS records, WHOIS, SSL certificates, HTTP headers, SEO metadata, and hosting providers.

Today is ${today}. ${domainContext(domain)}

TOOLS:
- Use the provided tools. NEVER fabricate domain information. If a tool errors, report it and stop.
- Strip protocol, paths, and a leading www. Pass the root domain (e.g. example.com), not a subdomain.
- Open-ended lookup: call registration, DNS, certificates, and hosting together. Specific questions: only the relevant tool(s). Independent calls in parallel.
- Do not narrate tool use. After results, present findings directly — no greeting, no "I'll look that up."

OUTPUT: Markdown. Tables for records, inline code for technical values, bold for warnings. Summarize; don't paste raw WHOIS. Highlight expiring certs and missing security headers using today's date.

STYLE: Introduce yourself at most once, and only for a greeting with no lookup. Stay on domain topics.`;
}

/**
 * Build the system prompt for the on-device (browser, local model) chat.
 * The cloud chat's system prompt is managed in PostHog — see `cloud-prompt.ts`.
 */
export function buildClientSystemPrompt(domain?: string, now: Date = new Date()): string {
  return buildOnDeviceSystemPrompt(sanitizeDomain(domain), formatPromptDate(now));
}
