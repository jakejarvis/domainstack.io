import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AddDomainModalClient } from "@/components/dashboard/add-domain/add-domain-modal-client";
import { AddDomainSkeleton } from "@/components/dashboard/add-domain/add-domain-skeleton";
import { Modal, ModalContent } from "@/components/modal";
import { getServerSession } from "@/lib/auth/session";
import { createMetadata } from "@/lib/seo";
import { ScrollArea } from "@domainstack/ui/scroll-area";

export const metadata: Metadata = createMetadata({
  path: "/dashboard/add-domain",
  title: "Add Domain",
  description: "Add a domain to track registration, DNS, SSL, and hosting changes.",
  robots: {
    index: false,
    follow: false,
  },
});

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
  const [session, { domain }] = await Promise.all([getServerSession(), searchParams]);

  if (!session?.user) {
    redirect("/login");
  }

  return <AddDomainModalClient prefillDomain={domain} />;
}
