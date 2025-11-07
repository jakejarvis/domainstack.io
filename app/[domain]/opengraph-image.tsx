import { ImageResponse } from "next/og";
import { LogoSimple } from "@/components/logo";
import { normalizeDomainInput } from "@/lib/domain";
import { BRAND, CHIPS, hexToRGBA, loadFontsForOG } from "@/lib/opengraph-image";

export const alt = "Domainstack — Domain Report";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage({
  params,
}: {
  params: Promise<{ domain: string }>;
}) {
  const { domain } = await params;
  const decoded = decodeURIComponent(domain);
  const normalized = normalizeDomainInput(decoded);

  const fonts = await loadFontsForOG();

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        background: BRAND.bg,
        fontFamily: "Geist", // must match fonts[].name
      }}
    >
      {/* Ambient glows: use backgroundImage with rgba alphas (Satori-safe) */}
      <div
        style={{
          position: "absolute",
          inset: "-10%",
          backgroundColor: "transparent",
          // Multiple backgrounds: each radial-gradient adds a soft glow
          backgroundImage: [
            `radial-gradient(900px 520px at 12% 18%, ${BRAND.a} 0%, rgba(0,0,0,0) 60%)`,
            `radial-gradient(1000px 560px at 86% 24%, ${BRAND.b} 0%, rgba(0,0,0,0) 62%)`,
            `radial-gradient(800px 520px at 50% 112%, ${BRAND.c} 0%, rgba(0,0,0,0) 62%)`,
            // vignette for edge depth
            `radial-gradient(1400px 700px at 50% 50%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.35) 100%)`,
          ].join(","),
        }}
      />

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
          <LogoSimple
            width={40}
            height={40}
            style={{
              color: BRAND.fg,
              display: "block",
              borderRadius: 12,
              background: "linear-gradient(135deg, #1A1F27 0%, #0F1216 100%)",
              boxShadow:
                "0 8px 40px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.06)",
              padding: 8,
            }}
          />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: 22,
                color: BRAND.fg,
                letterSpacing: 0.3,
                fontWeight: 600,
              }}
            >
              Domainstack
            </div>
            <div style={{ fontSize: 14, color: BRAND.sub }}>
              Domain Intelligence Made Easy
            </div>
          </div>
        </div>

        {/* Title + subtitle + chips */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div
            style={{
              fontSize: 84,
              lineHeight: 1.05,
              fontWeight: 700,
              color: BRAND.fg,
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

          <div
            style={{
              display: "flex",
              fontSize: 24,
              lineHeight: 1.5,
              color: BRAND.sub,
              maxWidth: 990,
            }}
          >
            Unlock full domain intelligence for {normalized}, including:
          </div>

          <div
            style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 6 }}
          >
            {CHIPS.map(({ label, color }) => (
              <div
                key={label}
                style={{
                  fontSize: 20,
                  color: BRAND.fg,
                  padding: "10px 16px",
                  borderRadius: 999,
                  background: `linear-gradient(180deg, ${hexToRGBA(color, 0.1)} 0%, rgba(255,255,255,0.03) 100%)`,
                  border: `1px solid ${hexToRGBA(color, 0.28)}`,
                  boxShadow:
                    "0 1px 0 rgba(255,255,255,0.05) inset, 0 8px 24px rgba(0,0,0,0.35)",
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
            <div style={{ color: BRAND.sub, fontSize: 18 }}>Live data</div>
          </div>
          <div style={{ color: BRAND.fg, fontSize: 18 }}>domainstack.io</div>
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts,
      headers: {
        "Cache-Control": "public, max-age=604800, stale-while-revalidate=3600",
        "Vercel-CDN-Cache-Control":
          "max-age=604800, stale-while-revalidate=3600",
      },
    },
  );
}
