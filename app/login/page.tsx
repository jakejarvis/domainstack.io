import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AnimatedBackground } from "@/components/auth/animated-background";
import { LoginContent } from "@/components/auth/login-content";
import { auth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to track your domains and receive health alerts.",
};

export default async function LoginPage() {
  // Check if already authenticated
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <AnimatedBackground />
      <LoginContent
        className={cn(
          "max-w-md",
          // Frosted glass in both light + dark mode (with a bit more presence in light mode).
          "border-black/15 bg-background/75 shadow-2xl ring-1 ring-black/5 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/60 dark:border-white/8 dark:bg-background/65 dark:ring-white/5 dark:supports-[backdrop-filter]:bg-background/55",
        )}
      />
    </div>
  );
}
