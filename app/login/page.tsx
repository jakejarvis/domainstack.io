import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AnimatedBackground } from "@/components/auth/animated-background";
import { LoginContent } from "@/components/auth/login-content";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to track your domains and receive expiration alerts.",
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
    <div className="flex min-h-screen items-center justify-center p-4">
      <AnimatedBackground />
      <LoginContent className="max-w-md" />
    </div>
  );
}
