import type {
  CertificatesResponse,
  DnsRecordsResponse,
  HeadersResponse,
  HostingResponse,
  RegistrationResponse,
  SeoResponse,
  TRPCResponse,
} from "../utils/types";

const BASE_URL = "https://domainstack.io";

/**
 * tRPC raw response structure.
 */
interface TRPCRawResponse<T> {
  result?: {
    data?: {
      json?: T;
    };
  };
  error?: {
    message?: string;
    json?: {
      message?: string;
    };
  };
}

/**
 * Make a tRPC query call to Domainstack API.
 */
async function trpcQuery<T>(
  procedure: string,
  input: Record<string, unknown>,
): Promise<TRPCResponse<T>> {
  const url = `${BASE_URL}/api/trpc/${procedure}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Domainstack-Raycast/1.0",
    },
    body: JSON.stringify({ json: input }),
  });

  if (response.status === 429) {
    const retryAfter = response.headers.get("Retry-After");
    const message = retryAfter
      ? `Rate limited. Retry after ${retryAfter} seconds.`
      : "Rate limited. Please try again later.";
    return { success: false, error: message };
  }

  if (!response.ok) {
    return {
      success: false,
      error: `API error: ${response.status} ${response.statusText}`,
    };
  }

  const data = (await response.json()) as TRPCRawResponse<TRPCResponse<T>>;

  if (data.error) {
    const errorMessage =
      data.error.json?.message || data.error.message || "Unknown API error";
    return { success: false, error: errorMessage };
  }

  const result = data.result?.data?.json;
  if (!result) {
    return { success: false, error: "Invalid API response" };
  }

  return result;
}

/**
 * Fetch registration (WHOIS/RDAP) data for a domain.
 */
export async function getRegistration(
  domain: string,
): Promise<TRPCResponse<RegistrationResponse>> {
  return trpcQuery<RegistrationResponse>("domain.getRegistration", { domain });
}

/**
 * Fetch DNS records for a domain.
 */
export async function getDnsRecords(
  domain: string,
): Promise<TRPCResponse<DnsRecordsResponse>> {
  return trpcQuery<DnsRecordsResponse>("domain.getDnsRecords", { domain });
}

/**
 * Fetch hosting/provider data for a domain.
 */
export async function getHosting(
  domain: string,
): Promise<TRPCResponse<HostingResponse>> {
  return trpcQuery<HostingResponse>("domain.getHosting", { domain });
}

/**
 * Fetch SSL certificate data for a domain.
 */
export async function getCertificates(
  domain: string,
): Promise<TRPCResponse<CertificatesResponse>> {
  return trpcQuery<CertificatesResponse>("domain.getCertificates", { domain });
}

/**
 * Fetch HTTP headers for a domain.
 */
export async function getHeaders(
  domain: string,
): Promise<TRPCResponse<HeadersResponse>> {
  return trpcQuery<HeadersResponse>("domain.getHeaders", { domain });
}

/**
 * Fetch SEO metadata for a domain.
 */
export async function getSeo(
  domain: string,
): Promise<TRPCResponse<SeoResponse>> {
  return trpcQuery<SeoResponse>("domain.getSeo", { domain });
}
