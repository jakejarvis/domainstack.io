"use client";

import { AppProgressProvider as ProgressProvider } from "@bprogress/next";
import { ThemeProvider } from "next-themes";
import { PostHogIdentityProvider } from "@/components/analytics/posthog-identity";
import { TRPCProvider } from "@/trpc/client";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TRPCProvider>
      <PostHogIdentityProvider>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          storageKey="theme"
          enableSystem
          disableTransitionOnChange
        >
          <ProgressProvider
            options={{ showSpinner: false }}
            shallowRouting
            disableStyle
          >
            {children}
          </ProgressProvider>
        </ThemeProvider>
      </PostHogIdentityProvider>
    </TRPCProvider>
  );
}
