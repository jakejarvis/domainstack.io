"use client";

import { AppProgressProvider as ProgressProvider } from "@bprogress/next";
import { ThemeProvider } from "next-themes";
import { TRPCProvider } from "@/trpc/client";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TRPCProvider>
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
    </TRPCProvider>
  );
}
