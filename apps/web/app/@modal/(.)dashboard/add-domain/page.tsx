import { auth } from "@domainstack/auth/server";
import { ScrollArea } from "@domainstack/ui/scroll-area";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AddDomainModalClient } from "@/components/dashboard/add-domain/add-domain-modal-client";
import { AddDomainSkeleton } from "@/components/dashboard/add-domain/add-domain-skeleton";
import { Modal, ModalContent } from "@/components/modal";

export default function InterceptedAddDomainPage({
  searchParams,
}: {
  searchParams: Promise<{ domain?: string }>;
}) {
  return (
    <Modal>
      <ModalContent>
        <ScrollArea className="min-h-0 flex-1 bg-popover/10">
          <div className="min-w-0 p-5 [contain:inline-size]">
            <Suspense fallback={<AddDomainSkeleton />}>
              <AuthorizedAddDomainContent searchParams={searchParams} />
            </Suspense>
          </div>
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
