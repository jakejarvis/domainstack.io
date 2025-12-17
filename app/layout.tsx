import { Analytics } from "@vercel/analytics/next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Providers } from "@/app/providers";
import { CookiePromptGeofenced } from "@/components/consent/cookie-prompt-geofenced";
import { AppFooter } from "@/components/layout/app-footer";
import { AppHeader } from "@/components/layout/app-header";
import { Toaster } from "@/components/ui/sonner";
import { BASE_URL } from "@/lib/constants/app";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Domainstack — Domain Intelligence Made Easy",
    template: "%s — Domainstack",
  },
  description:
    "Unlock full domain intelligence in one tool. Instantly view registration history, DNS and SSL records, HTTP headers, hosting & email details, and live SEO signals — all in one clean, fast interface.",
  metadataBase: new URL(BASE_URL),
  alternates: {
    canonical: "/",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // iOS 26 quirk, extends the viewport behind the liquid glass address bar
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfcfc" },
    { media: "(prefers-color-scheme: dark)", color: "#252525" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} touch-manipulation`}
      suppressHydrationWarning
    >
      <head>
        <link
          rel="search"
          href="/opensearch.xml"
          type="application/opensearchdescription+xml"
          title="Domainstack"
        />
      </head>
      <body className="relative min-h-svh overscroll-none font-sans tabular-nums antialiased">
        <Providers>
          {/* App Shell */}
          <div className="isolate flex min-h-svh flex-col">
            <AppHeader />
            <main className="flex min-h-0 flex-1 flex-col">{children}</main>
            <AppFooter />
          </div>

          <Toaster />
          <Suspense fallback={null}>
            <CookiePromptGeofenced />
          </Suspense>
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
