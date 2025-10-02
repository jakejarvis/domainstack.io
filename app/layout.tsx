import { Analytics } from "@vercel/analytics/next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import { AppFooter } from "@/components/app-footer";
import { AppHeader } from "@/components/app-header";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TRPCProvider } from "@/trpc/client";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hoot — Domain Intelligence Made Easy",
  description: "Investigate domains with WHOIS, DNS, SSL, headers, and more.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} slashed-zero tabular-nums antialiased selection:bg-[#6a6a6a] selection:text-white`}
      >
        <ThemeProvider>
          {/* Solid background for light/dark modes */}
          <div aria-hidden className="-z-10 fixed inset-0 bg-background" />

          {/* App Shell */}
          <TRPCProvider>
            <div className="isolate flex min-h-svh flex-col">
              <AppHeader />
              <main className="flex min-h-0 flex-1 flex-col">{children}</main>
              <AppFooter />
            </div>
          </TRPCProvider>
          <Toaster richColors closeButton />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
