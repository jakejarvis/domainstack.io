"use client";

import { AppProgressProvider as ProgressProvider } from "@bprogress/next";
import { LazyMotion, MotionConfig, domMax } from "motion/react";
import { ThemeProvider } from "next-themes";

import { PostHogIdentityProvider } from "@/components/analytics/posthog-identity";
import { HapticsProvider } from "@/components/providers/haptics-provider";
import { TRPCProvider } from "@/trpc/client";
import { TooltipProvider } from "@domainstack/ui/tooltip";

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
          <TooltipProvider>
            <ProgressProvider options={{ showSpinner: false }} shallowRouting disableStyle>
              <MotionConfig
                reducedMotion="user"
                transition={{
                  duration: 0.18,
                  ease: [0.22, 1, 0.36, 1] as const,
                }}
              >
                <LazyMotion features={domMax}>
                  <HapticsProvider>{children}</HapticsProvider>
                </LazyMotion>
              </MotionConfig>
            </ProgressProvider>
          </TooltipProvider>
        </ThemeProvider>
      </PostHogIdentityProvider>
    </TRPCProvider>
  );
}
