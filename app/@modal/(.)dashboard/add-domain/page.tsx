import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AddDomainModalClient } from "@/components/dashboard/add-domain/add-domain-modal-client";
import { AddDomainSkeleton } from "@/components/dashboard/add-domain/add-domain-skeleton";
import { Modal, ModalContent } from "@/components/ui/modal";
import { ScrollArea } from "@/components/ui/scroll-area";
import { auth } from "@/lib/auth";

export default function InterceptedAddDomainPage({
  searchParams,
}: {
  searchParams: Promise<{ domain?: string }>;
}) {
  return (
    <Modal>
      <ModalContent>
        <ScrollArea className="min-h-0 flex-1 p-5">
          <Suspense fallback={<AddDomainSkeleton />}>
            <AuthorizedAddDomainContent searchParams={searchParams} />
          </Suspense>
        </ScrollArea>
      </ModalContent>
    </Modal>
  );
}

async function AuthorizedAddDomainContent({
  searchParams,
}: {
  searchParams: Promise<{ domain?: string }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  const { domain } = await searchParams;

  return <AddDomainModalClient prefillDomain={domain} />;
}
