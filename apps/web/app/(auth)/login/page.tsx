import type { Metadata } from "next";

import { LoginContent } from "@/components/auth/login-content";
import { createMetadata } from "@/lib/seo";
import { Card } from "@domainstack/ui/card";

export const metadata: Metadata = createMetadata({
  path: "/login",
  title: "Sign In",
  description: "Sign in to track your domains and receive health alerts.",
});

export default function LoginPage() {
  return (
    <Card className="w-full max-w-md overflow-hidden px-6">
      <LoginContent />
    </Card>
  );
}
