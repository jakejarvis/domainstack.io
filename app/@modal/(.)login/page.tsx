import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginContent } from "@/components/auth/login-content";
import { LoginSkeleton } from "@/components/auth/login-skeleton";
import { Modal } from "@/components/layout/modal";
import { auth } from "@/lib/auth";

export default function InterceptedLoginPage() {
  return (
    <Modal
      title="Sign In"
      description="Sign in to track your domains and receive health alerts."
    >
      <Suspense fallback={<LoginSkeleton />}>
        <AuthorizedLoginContent />
      </Suspense>
    </Modal>
  );
}

async function AuthorizedLoginContent() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session?.user) {
    redirect("/dashboard");
  }

  return <LoginContent />;
}
