"use client";

import { Suspense, useEffect, useState } from "react";

import { LoginContent } from "@/components/auth/login-content";
import { LoginSkeleton } from "@/components/auth/login-skeleton";
import { Modal, ModalContent } from "@/components/modal";
import { useRouter } from "@/hooks/use-router";
import { useSession } from "@domainstack/auth/client";

export function LoginModalClient() {
  const [open, setOpen] = useState(true);
  return (
    <Modal open={open}>
      <ModalContent className="!max-w-md p-6">
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

  const isSignedIn = Boolean(session?.user);
  useEffect(() => {
    if (isSignedIn) {
      router.replace("/dashboard");
    }
  }, [isSignedIn, router]);

  return <LoginContent onNavigate={onNavigate} />;
}
