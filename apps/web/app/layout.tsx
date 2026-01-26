import { Analytics } from "@vercel/analytics/next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Providers } from "@/app/providers";
import { ChatTrigger } from "@/components/chat/chat-trigger";
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
    "Instant lookups for WHOIS, DNS, hosting, certificates, SEO and more, plus free domain tracking and change alerts.",
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
  modal,
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode;
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
      <body className="relative min-h-svh overscroll-none bg-background font-sans text-foreground tabular-nums antialiased [--header-height:72px]">
        <Providers>
          {/* Skip to main content link for keyboard navigation */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:font-medium focus:text-foreground focus:shadow-lg focus:ring-2 focus:ring-ring"
          >
            Skip to content
          </a>

          {/* App Shell */}
          <div data-slot="layout" className="isolate flex min-h-svh flex-col">
            <AppHeader />
            <main id="main-content" className="flex min-h-0 flex-1 flex-col">
              {children}
            </main>
            <AppFooter />

            {/* Fixed-positioned elements that should be inside flex context for Safari */}
            <Suspense fallback={null}>
              <CookiePromptGeofenced />
            </Suspense>
            <Suspense fallback={null}>
              <ChatTrigger />
            </Suspense>
          </div>
          <Toaster />

          {modal}
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
