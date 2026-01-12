import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginContent } from "@/components/auth/login-content";
import { LoginSkeleton } from "@/components/auth/login-skeleton";
import { Modal, ModalContent } from "@/components/ui/modal";
import { auth } from "@/lib/auth";

export default function InterceptedLoginPage() {
  return (
    <Modal>
      <ModalContent className="!max-w-md px-5 py-6">
        <Suspense fallback={<LoginSkeleton />}>
          <AuthorizedLoginContent />
        </Suspense>
      </ModalContent>
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
