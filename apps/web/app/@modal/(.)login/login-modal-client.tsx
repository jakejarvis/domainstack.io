"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { LoginContent } from "@/components/auth/login-content";
import { LoginSkeleton } from "@/components/auth/login-skeleton";
import { Modal, ModalContent, ModalTitle } from "@/components/modal";
import { useRouter } from "@/hooks/use-router";
import { safeNextPath } from "@/lib/safe-next-path";
import { useSession } from "@domainstack/auth/client";

export function LoginModalClient() {
  const [open, setOpen] = useState(true);
  return (
    <Modal open={open}>
      <ModalContent className="!max-w-md p-6">
        <ModalTitle className="sr-only">Sign in</ModalTitle>
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
  const searchParams = useSearchParams();
  const destination = safeNextPath(searchParams.get("next")) ?? "/dashboard";

  const isSignedIn = Boolean(session?.user);
  useEffect(() => {
    if (isSignedIn) {
      router.replace(destination);
    }
  }, [isSignedIn, router, destination]);

  return <LoginContent onNavigate={onNavigate} />;
}
