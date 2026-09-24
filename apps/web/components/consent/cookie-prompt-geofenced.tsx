import { headers } from "next/headers";

import { GDPR_COUNTRY_CODES } from "@domainstack/constants";

import { CookiePrompt } from "./cookie-prompt";

export async function CookiePromptGeofenced() {
  const headersList = await headers();
  const country = headersList.get("x-vercel-ip-country");

  // Default to requiring consent if header is missing (safer default)
  const consentRequired = country === null || GDPR_COUNTRY_CODES.has(country);

  return <CookiePrompt consentRequired={consentRequired} />;
}
