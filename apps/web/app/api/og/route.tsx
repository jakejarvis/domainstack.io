/* oxlint-disable nextjs/no-img-element -- ImageResponse requires raw img elements. */
import { cacheLife } from "next/cache";
import { ImageResponse } from "next/og";
import { type NextRequest, NextResponse } from "next/server";

import { Logo } from "@/components/logo";
import { loadGoogleFont, OG_BACKGROUND_IMAGE, OG_IMAGE_SIZE } from "@/lib/og-utils";
import { checkRateLimit } from "@/lib/ratelimit/api";
import { createCaller } from "@domainstack/api";
import { createLogger } from "@domainstack/logger";
import type { ProviderRef } from "@domainstack/types";
import { toRegistrableDomain } from "@domainstack/utils/domain";
import { normalizeDomainInput } from "@domainstack/utils/domain/client";

const SIZE = OG_IMAGE_SIZE;

const logger = createLogger({ source: "api/og" });

const PROVIDER_COLORS = {
  registrar: "#6D5DE7",
  dns: "#148DA1",
  hosting: "#37865A",
  email: "#3972B7",
  certificate: "#B15A84",
} as const;

const PROVIDER_LAYERS = [
  { type: "Registrar", label: "Registrar", color: PROVIDER_COLORS.registrar },
  { type: "DNS", label: "DNS", color: PROVIDER_COLORS.dns },
  { type: "Hosting", label: "Hosting", color: PROVIDER_COLORS.hosting },
  { type: "Email", label: "Email", color: PROVIDER_COLORS.email },
  { type: "Certificate", label: "TLS", color: PROVIDER_COLORS.certificate },
] as const;

type ProviderType = (typeof PROVIDER_LAYERS)[number]["type"];

interface ProviderChip {
  type: ProviderType;
  name: string;
  logoUrl: string | null;
  color: string;
}

interface ProviderData {
  providers: ProviderChip[];
}

function getDomainFontSize(domain: string): number {
  if (domain.length > 32) return 50;
  if (domain.length > 24) return 58;
  return 68;
}

async function fetchProviderData(domain: string): Promise<ProviderData> {
  "use cache: remote";

  try {
    // Anonymous caller: this path is metered at the route level (see the
    // checkRateLimit call in GET), not per-procedure, because "use cache"
    // would otherwise fragment the cache per client IP.
    const caller = createCaller({ req: undefined, ip: null, session: null });

    // Fetch registration, hosting, and certificates in parallel
    const [registrationResult, hostingResult, certificatesResult] = await Promise.all([
      caller.domain.getRegistration({ domain }),
      caller.domain.getHosting({ domain }),
      caller.domain.getCertificates({ domain }),
    ]);

    // Collect all provider refs
    const providerRefs: { type: ProviderType; ref: ProviderRef; color: string }[] = [];

    // Extract registrar (first, as it's the most important)
    if (registrationResult.success && registrationResult.data) {
      const { registrarProvider } = registrationResult.data;
      if (registrarProvider.name) {
        providerRefs.push({
          type: "Registrar",
          ref: registrarProvider,
          color: PROVIDER_COLORS.registrar,
        });
      }
    }

    // Extract hosting providers
    if (hostingResult.success && hostingResult.data) {
      const { dnsProvider, hostingProvider, emailProvider } = hostingResult.data;

      if (dnsProvider.name) {
        providerRefs.push({
          type: "DNS",
          ref: dnsProvider,
          color: PROVIDER_COLORS.dns,
        });
      }

      if (hostingProvider.name) {
        providerRefs.push({
          type: "Hosting",
          ref: hostingProvider,
          color: PROVIDER_COLORS.hosting,
        });
      }

      if (emailProvider.name) {
        providerRefs.push({
          type: "Email",
          ref: emailProvider,
          color: PROVIDER_COLORS.email,
        });
      }
    }

    // Extract CA from first certificate
    if (certificatesResult.success && certificatesResult.data?.certificates?.length) {
      const ca = certificatesResult.data.certificates[0].caProvider;
      if (ca.name) {
        providerRefs.push({
          type: "Certificate",
          ref: ca,
          color: PROVIDER_COLORS.certificate,
        });
      }
    }

    // Build provider chips with logo URLs
    const providers: ProviderChip[] = providerRefs.map((p) => ({
      type: p.type,
      name: p.ref.name ?? "",
      logoUrl: p.ref.domain
        ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(p.ref.domain)}&sz=64`
        : null,
      color: p.color,
    }));

    // Cache successful data for 1 day
    cacheLife("days");

    return { providers };
  } catch (err) {
    logger.debug({ err, domain }, "provider data unavailable for OG image");
  }

  // Cache failure briefly
  cacheLife("minutes");

  return { providers: [] };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get("domain");

  if (!domain) {
    return new NextResponse("Missing domain parameter", { status: 400 });
  }

  const normalized = normalizeDomainInput(domain);

  // Validate that this is a registrable domain
  const registrable = toRegistrableDomain(normalized);
  if (!registrable) {
    return new NextResponse("Invalid domain", { status: 400 });
  }

  // Each distinct domain costs three live upstream lookups (RDAP/WHOIS, hosting,
  // certificates), so this route must be metered even though it is public.
  const rateLimit = await checkRateLimit(request, {
    name: "api:og:get",
    requests: 30,
    window: "1 m",
  });

  if (!rateLimit.success) {
    return rateLimit.error;
  }

  // Fetch fonts and provider data in parallel
  const [geistRegularFont, geistSemiBoldFont, providerData] = await Promise.all([
    loadGoogleFont("Geist", 400),
    loadGoogleFont("Geist", 600),
    fetchProviderData(registrable),
  ]);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        padding: 28,
        color: "#171717",
        backgroundImage: OG_BACKGROUND_IMAGE,
        fontFamily: "Geist", // must match fonts[].name
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 28,
          right: 28,
          width: 430,
          height: 250,
          borderRadius: 24,
          backgroundImage:
            "radial-gradient(circle at 50% 45%, rgba(109, 93, 231, 0.13), rgba(109, 93, 231, 0) 68%)",
        }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          border: "1px solid rgba(23, 23, 23, 0.13)",
          borderRadius: 24,
          background: "rgba(255, 255, 255, 0.72)",
          boxShadow: "0 24px 60px rgba(23, 23, 23, 0.08)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: 76,
            padding: "0 32px",
            borderBottom: "1px solid rgba(23, 23, 23, 0.1)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Logo width={32} height={32} style={{ color: "#171717", display: "block" }} />
            <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: -0.3 }}>Domainstack</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: "#4C9A6A",
                boxShadow: "0 0 0 4px rgba(76, 154, 106, 0.12)",
              }}
            />
            <div style={{ color: "#666662", fontSize: 15 }}>Live domain report</div>
          </div>
        </div>

        <div style={{ display: "flex", flex: 1, padding: "34px 32px 30px", gap: 34 }}>
          <div
            style={{
              display: "flex",
              flex: 1,
              flexDirection: "column",
              justifyContent: "center",
              minWidth: 0,
              padding: "6px 4px",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div
                style={{
                  display: "flex",
                  width: 80,
                  height: 80,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 18,
                  border: "1px solid rgba(23, 23, 23, 0.12)",
                  background: "rgba(255, 255, 255, 0.88)",
                  boxShadow: "0 10px 30px rgba(23, 23, 23, 0.08)",
                }}
              >
                <img
                  src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(registrable)}&sz=128`}
                  alt=""
                  width={48}
                  height={48}
                  style={{ borderRadius: 9 }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <div
                  style={{
                    display: "block",
                    maxWidth: 650,
                    overflow: "hidden",
                    color: "#171717",
                    fontSize: getDomainFontSize(registrable),
                    fontWeight: 600,
                    letterSpacing: -2.6,
                    lineHeight: 1.02,
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {registrable}
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              width: 398,
              flexDirection: "column",
              overflow: "hidden",
              borderRadius: 18,
              border: "1px solid rgba(23, 23, 23, 0.12)",
              background: "rgba(250, 250, 248, 0.9)",
            }}
          >
            <div
              style={{
                display: "flex",
                height: 64,
                alignItems: "center",
                padding: "0 20px",
                borderBottom: "1px solid rgba(23, 23, 23, 0.1)",
              }}
            >
              <div style={{ fontSize: 17, fontWeight: 600 }}>Infrastructure stack</div>
            </div>
            <div style={{ display: "flex", flex: 1, flexDirection: "column" }}>
              {PROVIDER_LAYERS.map((layer, index) => {
                const provider = providerData.providers.find((item) => item.type === layer.type);

                return (
                  <div
                    key={layer.type}
                    style={{
                      display: "flex",
                      flex: 1,
                      alignItems: "center",
                      gap: 13,
                      minHeight: 0,
                      padding: "0 20px",
                      borderBottom:
                        index < PROVIDER_LAYERS.length - 1
                          ? "1px solid rgba(23, 23, 23, 0.075)"
                          : "0px solid transparent",
                    }}
                  >
                    <div
                      style={{ width: 4, height: 28, borderRadius: 999, background: layer.color }}
                    />
                    <div
                      style={{
                        display: "flex",
                        width: 91,
                        color: "#777772",
                        fontSize: 14,
                      }}
                    >
                      {layer.label}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        minWidth: 0,
                        flex: 1,
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      {provider?.logoUrl ? (
                        <img
                          src={provider.logoUrl}
                          alt=""
                          width={24}
                          height={24}
                          style={{ borderRadius: 6 }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 6,
                            border: "1px solid rgba(23, 23, 23, 0.1)",
                            background: "rgba(23, 23, 23, 0.035)",
                          }}
                        />
                      )}
                      <div
                        style={{
                          display: "block",
                          maxWidth: 195,
                          overflow: "hidden",
                          color: provider ? "#262624" : "#9A9A94",
                          fontSize: 16,
                          fontWeight: provider ? 600 : 400,
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {provider?.name ?? "Not detected"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            height: 54,
            alignItems: "center",
            justifyContent: "flex-end",
            padding: "0 32px",
            borderTop: "1px solid rgba(23, 23, 23, 0.1)",
            color: "#777772",
            fontSize: 14,
          }}
        >
          <div style={{ color: "#343431", fontWeight: 600 }}>domainstack.io</div>
        </div>
      </div>
    </div>,
    {
      ...SIZE,
      fonts: [
        {
          name: "Geist",
          data: geistRegularFont,
          style: "normal",
          weight: 400,
        },
        {
          name: "Geist",
          data: geistSemiBoldFont,
          style: "normal",
          weight: 600,
        },
      ],
      headers: {
        "Cache-Control": "public, max-age=3600",
        "Vercel-CDN-Cache-Control": "public, s-maxage=604800, stale-while-revalidate=86400",
      },
    },
  );
}
