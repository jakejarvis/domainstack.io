import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import Link from "next/link";

import { notFoundMetadata } from "@/lib/seo";

import "./globals.css";

export const metadata: Metadata = notFoundMetadata;

// Rendered for URLs that match no route. Bypasses the root layout, so it must
// supply its own <html>/<body>, styles, and theme. In-route `notFound()` calls
// still render `not-found.tsx` inside the app shell.
export default function GlobalNotFound() {
  return (
    <html lang="en" className={GeistSans.variable} suppressHydrationWarning>
      <body className="flex min-h-svh items-center justify-center bg-background px-6 font-sans text-foreground antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" storageKey="theme" enableSystem>
          <main className="text-center">
            <h1 className="text-2xl font-semibold">404 - Not Found</h1>
            <p className="mt-2 text-muted-foreground">
              The page you&apos;re looking for doesn&apos;t exist.
            </p>
            <Link href="/" className="mt-6 inline-block underline underline-offset-4">
              Back to Domainstack
            </Link>
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
