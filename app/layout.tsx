import { Analytics } from "@vercel/analytics/next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Providers } from "@/app/providers";
import { AppFooter } from "@/components/app-footer";
import { AppHeader } from "@/components/app-header";
import { Toaster } from "@/components/ui/sonner";
import { BASE_URL } from "@/lib/constants";
import { TRPCProvider } from "@/trpc/client";

import "./globals.css";

export const metadata: Metadata = {
  title: "Domainstack — Domain Intelligence Made Easy",
  description: "Investigate domains with WHOIS, DNS, SSL, headers, and more.",
  metadataBase: new URL(BASE_URL),
  alternates: {
    canonical: "/",
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
