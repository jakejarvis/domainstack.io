"use client";

import { Suspense, useState } from "react";
import { LoginContent } from "@/components/auth/login-content";
import { LoginSkeleton } from "@/components/auth/login-skeleton";
import { Modal, ModalContent } from "@/components/ui/modal";
import { useRouter } from "@/hooks/use-router";
import { useSession } from "@/lib/auth-client";

export default function InterceptedLoginPage() {
  const [open, setOpen] = useState(true);
  return (
    <Modal open={open}>
      <ModalContent className="!max-w-md px-5 py-6">
        <Suspense fallback={<LoginSkeleton />}>
          <AuthorizedLoginContent onNavigate={() => setOpen(false)} />
        </Suspense>
      </ModalContent>
    </Modal>
  );
}

function AuthorizedLoginContent({ onNavigate }: { onNavigate: () => void }) {
  const { data: session } = useSession();
  const router = useRouter();

  if (session?.user) {
    router.replace("/dashboard");
  }

  return <LoginContent onNavigate={onNavigate} />;
}
