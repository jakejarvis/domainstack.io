import { Analytics } from "@vercel/analytics/next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Providers } from "@/app/providers";
import { AppFooter } from "@/components/layout/app-footer";
import { AppHeader } from "@/components/layout/app-header";
import { Toaster } from "@/components/ui/sonner";
import { BASE_URL } from "@/lib/constants";
import { TRPCProvider } from "@/trpc/client";

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
  formatDetection: {
    telephone: false,
    date: false,
    address: false,
    email: false,
    url: false,
  },
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
      <body className="min-h-svh overscroll-none font-sans tabular-nums antialiased">
        <Providers>
          {/* Solid background for light/dark modes */}
          <div aria-hidden className="-z-10 fixed inset-0 bg-background" />

          {/* App Shell */}
          <div className="isolate flex min-h-svh flex-col">
            <AppHeader />
            <main className="flex min-h-0 flex-1 flex-col">
              <Suspense fallback={<div />}>
                <TRPCProvider>{children}</TRPCProvider>
              </Suspense>
            </main>
            <AppFooter />
          </div>
          <Toaster />
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
