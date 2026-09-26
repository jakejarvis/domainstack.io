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
        padding: 28,
        color: "#171717",
        backgroundImage: OG_BACKGROUND_IMAGE,
        fontFamily: "Geist",
      }}
    >
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
            height: 76,
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 32px",
            borderBottom: "1px solid rgba(23, 23, 23, 0.1)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Logo width={32} height={32} style={{ color: "#171717", display: "block" }} />
            <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: -0.3 }}>{SITE_NAME}</div>
          </div>
          <div style={{ color: "#666662", fontSize: 15 }}>{SITE_TAGLINE}</div>
        </div>

        <div style={{ display: "flex", flex: 1, padding: "48px 40px 42px" }}>
          <div
            style={{
              display: "flex",
              flex: 1,
              flexDirection: "column",
              justifyContent: "center",
              gap: 22,
              maxWidth: 820,
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 68,
                lineHeight: 1.02,
                fontWeight: 600,
                color: "#171717",
                letterSpacing: -2.6,
                maxWidth: 650,
              }}
            >
              Inspect any domain.
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 21,
                lineHeight: 1.5,
                color: "#686864",
                maxWidth: 620,
              }}
            >
              {SITE_DESCRIPTION}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            height: 54,
            padding: "0 32px",
            borderTop: "1px solid rgba(23, 23, 23, 0.1)",
          }}
        >
          <div style={{ color: "#343431", fontSize: 14, fontWeight: 600 }}>domainstack.io</div>
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
