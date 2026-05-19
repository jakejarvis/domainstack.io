import { msg } from "@lingui/core/macro";
import { Analytics } from "@vercel/analytics/next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import { Suspense } from "react";

import { I18nClientProvider } from "@/app/i18n-provider";
import { Providers } from "@/app/providers";
import { ChatServer } from "@/components/chat/chat-server";
import { CookiePromptGeofenced } from "@/components/consent/cookie-prompt-geofenced";
import { AppFooter } from "@/components/layout/app-footer";
import { AppHeader } from "@/components/layout/app-header";
import { Toaster } from "@/components/ui/sonner";
import { getI18n, getRequestLocale } from "@/lib/i18n-server";
import { DEFAULT_LOCALE, getMessages } from "@domainstack/i18n";

import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await getI18n();
  return {
    title: {
      default: i18n._(msg`Domainstack — Domain Intelligence Made Easy`),
      template: "%s — Domainstack",
    },
    description: i18n._(
      msg`Instant lookups for WHOIS, DNS, hosting, certificates, SEO and more, plus free domain tracking and change alerts.`,
    ),
    metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"),
    alternates: {
      canonical: "/",
    },
  };
}

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
  // The shell stays static: the locale comes from a per-request cookie/header
  // (`getRequestLocale`), which is a dynamic API under Cache Components. Reading
  // it here would force the whole document (including <html>) dynamic with no
  // prerenderable shell. Instead, defer the dynamic read into <LocalizedApp>
  // behind <Suspense> so Next can prerender the shell and stream the rest.
  // `lang` uses DEFAULT_LOCALE in the static shell and is corrected client-side
  // by I18nClientProvider (hence `suppressHydrationWarning`).
  return (
    <html
      lang={DEFAULT_LOCALE}
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
        <Suspense fallback={null}>
          <LocalizedApp modal={modal}>{children}</LocalizedApp>
        </Suspense>
        <Analytics />
      </body>
    </html>
  );
}

async function LocalizedApp({
  children,
  modal,
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode;
}>) {
  const locale = await getRequestLocale();
  const [messages, i18n] = await Promise.all([getMessages(locale), getI18n()]);

  return (
    <I18nClientProvider locale={locale} messages={messages}>
      <Providers>
        {/* Skip to main content link for keyboard navigation */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:font-medium focus:text-foreground focus:shadow-lg focus:ring-2 focus:ring-ring"
        >
          {i18n._(msg`Skip to content`)}
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
            <ChatServer />
          </Suspense>
        </div>
        <Toaster />

        {modal}
      </Providers>
    </I18nClientProvider>
  );
}
