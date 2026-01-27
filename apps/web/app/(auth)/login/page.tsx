import { Card } from "@domainstack/ui/card";
import { cn } from "@domainstack/ui/utils";
import type { Metadata } from "next";
import { LoginContent } from "@/components/auth/login-content";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to track your domains and receive health alerts.",
};

export default function LoginPage() {
  return (
    <Card
      className={cn(
        "w-full max-w-md overflow-hidden rounded-xl px-6 py-8",
        "border-black/15 bg-background/70 shadow-2xl ring-1 ring-black/5 backdrop-blur-2xl dark:border-white/8 dark:bg-background/60 dark:ring-white/5",
      )}
    >
      <LoginContent />
    </Card>
  );
}
