"use client";

import { AppProgressProvider as ProgressProvider } from "@bprogress/next";
import { MotionConfig } from "motion/react";
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
            <MotionConfig
              reducedMotion="user"
              transition={{
                duration: 0.18,
                ease: [0.22, 1, 0.36, 1] as const,
              }}
            >
              {children}
            </MotionConfig>
          </ProgressProvider>
        </ThemeProvider>
      </PostHogIdentityProvider>
    </TRPCProvider>
  );
}
