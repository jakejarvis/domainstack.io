import type { Metadata } from "next";

import { LoginModalClient } from "./login-modal-client";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Domainstack to track domains and receive notifications.",
};

export default function InterceptedLoginPage() {
  return <LoginModalClient />;
}
