import { ImageResponse } from "next/og";

import { Logo } from "@/components/logo";
import { loadGoogleFont, OG_BACKGROUND_IMAGE, OG_IMAGE_SIZE } from "@/lib/og-utils";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_TITLE } from "@/lib/seo";

export const alt = SITE_TITLE;
export const size = OG_IMAGE_SIZE;
export const contentType = "image/png";

export default async function Image() {
  const [geistRegularFont, geistSemiBoldFont] = await Promise.all([
    loadGoogleFont("Geist", 400),
    loadGoogleFont("Geist", 600),
  ]);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        backgroundImage: OG_BACKGROUND_IMAGE,
        fontFamily: "Geist",
      }}
    >
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
              {SITE_NAME}
            </div>
            <div style={{ fontSize: 14, color: "#AAB3C2" }}>{SITE_TAGLINE}</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              display: "flex",
              fontSize: 64,
              lineHeight: 1.1,
              fontWeight: 600,
              color: "#EAEFF7",
              letterSpacing: -1.2,
              textShadow: "0 2px 16px rgba(0,0,0,0.35)",
              maxWidth: 980,
            }}
          >
            Inspect any domain.
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 26,
              lineHeight: 1.5,
              color: "#AAB3C2",
              maxWidth: 900,
            }}
          >
            {SITE_DESCRIPTION}
          </div>
        </div>

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
            <div style={{ color: "#AAB3C2", fontSize: 18 }}>WHOIS, DNS, SSL, hosting & SEO</div>
          </div>
          <div style={{ color: "#EAEFF7", fontSize: 18 }}>domainstack.io</div>
        </div>
      </div>
    </div>,
    {
      ...size,
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
    },
  );
}
