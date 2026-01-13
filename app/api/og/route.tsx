import { cacheLife } from "next/cache";
import { ImageResponse } from "next/og";
import { type NextRequest, NextResponse } from "next/server";
import { Logo } from "@/components/logo";
import { normalizeDomainInput } from "@/lib/domain-utils";
import { createLogger } from "@/lib/logger/server";
import { toRegistrableDomain } from "@/lib/normalize-domain";
import { hexToRGBA, loadGoogleFont } from "@/lib/og-utils";
import type { ProviderRef } from "@/lib/types/domain/provider-ref";
import { createCaller } from "@/server/routers/_app";

const SIZE = { width: 1200, height: 630 };

const logger = createLogger({ source: "og" });

// Provider colors for dynamic chips
const PROVIDER_COLORS = {
  registrar: "#7C5CFC",
  dns: "#00D4FF",
  hosting: "#22C55E",
  email: "#60A5FA",
  certificate: "#F472B6",
} as const;

interface ProviderChip {
  type: string;
  name: string;
  logoUrl: string | null;
  color: string;
}

interface ProviderData {
  providers: ProviderChip[];
}

async function fetchProviderData(domain: string): Promise<ProviderData> {
  "use cache";
  cacheLife("weeks"); // Cache provider data for 1 week

  try {
    // Create a lightweight caller for the API, we don't need auth context
    const caller = createCaller({ req: undefined, ip: null, session: null });

    // Fetch registration, hosting, and certificates in parallel
    const [registrationResult, hostingResult, certificatesResult] =
      await Promise.all([
        caller.domain.getRegistration({ domain }),
        caller.domain.getHosting({ domain }),
        caller.domain.getCertificates({ domain }),
      ]);

    // Collect all provider refs
    const providerRefs: { type: string; ref: ProviderRef; color: string }[] =
      [];

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
      const { dnsProvider, hostingProvider, emailProvider } =
        hostingResult.data;

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
    if (
      certificatesResult.success &&
      certificatesResult.data?.certificates?.length
    ) {
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

    return { providers };
  } catch (err) {
    logger.warn({ err, domain }, "failed to fetch provider data");
  }

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

  // Fetch fonts and provider data in parallel
  const [geistRegularFont, geistSemiBoldFont, providerData] = await Promise.all(
    [
      loadGoogleFont("Geist", 400),
      loadGoogleFont("Geist", 600),
      fetchProviderData(registrable),
    ],
  );

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        backgroundImage:
          "linear-gradient(346deg, rgba(55, 55, 55,0.04) 0%, rgba(55, 55, 55,0.04) 22%,rgba(140, 140, 140,0.04) 22%, rgba(140, 140, 140,0.04) 69%,rgba(225, 225, 225,0.04) 69%, rgba(225, 225, 225,0.04) 100%),linear-gradient(31deg, rgba(55, 55, 55,0.04) 0%, rgba(55, 55, 55,0.04) 42%,rgba(140, 140, 140,0.04) 42%, rgba(140, 140, 140,0.04) 85%,rgba(225, 225, 225,0.04) 85%, rgba(225, 225, 225,0.04) 100%),linear-gradient(55deg, rgba(55, 55, 55,0.04) 0%, rgba(55, 55, 55,0.04) 13%,rgba(140, 140, 140,0.04) 13%, rgba(140, 140, 140,0.04) 72%,rgba(225, 225, 225,0.04) 72%, rgba(225, 225, 225,0.04) 100%),linear-gradient(90deg, rgb(0,0,0),rgb(0,0,0))",
        fontFamily: "Geist", // must match fonts[].name
      }}
    >
      {/* Content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: "56px 64px",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Logo
            width={48}
            height={48}
            style={{
              color: "#EAEFF7",
              display: "block",
            }}
          />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: 22,
                color: "#EAEFF7",
                letterSpacing: 0.3,
                fontWeight: 600,
              }}
            >
              Domainstack
            </div>
            <div style={{ fontSize: 14, color: "#AAB3C2" }}>
              Domain Intelligence Made Easy
            </div>
          </div>
        </div>

        {/* Title + subtitle + chips */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            {/** biome-ignore lint/performance/noImgElement: OG image requires img element */}
            <img
              src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`}
              alt="favicon"
              width={64}
              height={64}
              style={{ borderRadius: 8 }}
            />
            <div
              style={{
                fontSize: 72,
                lineHeight: 1.1,
                fontWeight: 600,
                color: "#EAEFF7",
                letterSpacing: -1.2,
                textShadow: "0 2px 16px rgba(0,0,0,0.35)",
                maxWidth: 980,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={normalized}
            >
              {normalized}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 26,
              lineHeight: 1.5,
              color: "#AAB3C2",
              maxWidth: 990,
            }}
          >
            Domain intelligence report for {normalized}
          </div>

          <div
            style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 6 }}
          >
            {providerData.providers.length > 0
              ? providerData.providers.map((provider) => (
                  <div
                    key={provider.type}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      fontSize: 18,
                      color: "#EAEFF7",
                      padding: "12px 18px",
                      borderRadius: 12,
                      background: `linear-gradient(180deg, ${hexToRGBA(provider.color, 0.12)} 0%, rgba(255,255,255,0.03) 100%)`,
                      border: `1px solid ${hexToRGBA(provider.color, 0.32)}`,
                    }}
                  >
                    {provider.logoUrl && (
                      // biome-ignore lint/performance/noImgElement: OG image requires img element
                      <img
                        src={provider.logoUrl}
                        alt=""
                        width={24}
                        height={24}
                        style={{ borderRadius: 4 }}
                      />
                    )}
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <div
                        style={{
                          fontSize: 12,
                          color: provider.color,
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                        }}
                      >
                        {provider.type}
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 600 }}>
                        {provider.name}
                      </div>
                    </div>
                  </div>
                ))
              : // Fallback: show static placeholder chips when no data
                ["Registrar", "DNS", "Hosting", "SSL"].map((label) => (
                  <div
                    key={label}
                    style={{
                      fontSize: 20,
                      color: "#AAB3C2",
                      padding: "10px 16px",
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.12)",
                    }}
                  >
                    {label}
                  </div>
                ))}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            paddingTop: 18,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: "rgba(0, 212, 255, 1)",
                boxShadow: "0 0 20px rgba(0, 212, 255, 0.66)",
              }}
            />
            <div style={{ color: "#AAB3C2", fontSize: 18 }}>Live data</div>
          </div>
          <div style={{ color: "#EAEFF7", fontSize: 18 }}>domainstack.io</div>
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
        "Vercel-CDN-Cache-Control":
          "public, s-maxage=604800, stale-while-revalidate=86400",
      },
    },
  );
}
