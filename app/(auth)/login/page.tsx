import type { Metadata } from "next";
import { LoginContent } from "@/components/auth/login-content";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to track your domains and receive health alerts.",
};

export default function LoginPage() {
  return (
    <Card
      className={cn(
        "w-full max-w-md overflow-hidden rounded-3xl px-6 py-8",
        "border-black/15 bg-background/75 shadow-2xl ring-1 ring-black/5 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/60 dark:border-white/8 dark:bg-background/65 dark:ring-white/5 dark:supports-[backdrop-filter]:bg-background/55",
      )}
    >
      <LoginContent />
    </Card>
  );
}
