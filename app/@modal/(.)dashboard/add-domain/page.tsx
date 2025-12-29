import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AddDomainModalClient } from "@/components/dashboard/add-domain/add-domain-modal-client";
import { AddDomainSkeleton } from "@/components/dashboard/add-domain/add-domain-skeleton";
import { Modal } from "@/components/layout/modal";
import { auth } from "@/lib/auth";

export default function InterceptedAddDomainPage({
  searchParams,
}: {
  searchParams: Promise<{ domain?: string }>;
}) {
  return (
    <Modal
      title="Add Domain"
      description="Track and monitor your domain"
      className="max-w-lg"
    >
      <div className="px-6">
        <Suspense fallback={<AddDomainSkeleton />}>
          <AuthorizedAddDomainContent searchParams={searchParams} />
        </Suspense>
      </div>
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
