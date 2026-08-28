import type { Metadata } from "next";

import { createMetadata } from "@/lib/seo";

import { LoginModalClient } from "./login-modal-client";

export const metadata: Metadata = createMetadata({
  path: "/login",
  title: "Sign In",
  description: "Sign in to track your domains and receive health alerts.",
});

export default function InterceptedLoginPage() {
  return <LoginModalClient />;
}
