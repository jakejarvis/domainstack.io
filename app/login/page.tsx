import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LoginContent } from "@/components/auth/login-content";
import { auth } from "@/lib/auth";

export const metadata = {
  title: "Sign In | DomainStack",
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
      {/* Animated gradient background */}
      <div className="-z-10 pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-accent-blue/5 via-transparent to-accent-purple/5" />
        <div className="absolute top-1/4 left-1/4 h-96 w-96 animate-pulse rounded-full bg-accent-blue/10 blur-3xl" />
        <div className="absolute right-1/4 bottom-1/4 h-96 w-96 animate-pulse rounded-full bg-accent-purple/10 blur-3xl delay-1000" />
      </div>

      <LoginContent />
    </div>
  );
}
