import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { auth } from "@/lib/auth";

export default async function AccountLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Check authentication
  let session = null;
  try {
    const headerList = await headers();
    session = await auth.api.getSession({ headers: headerList });
  } catch {
    // Ignore auth errors
  }

  if (!session) {
    redirect("/");
  }

  return <>{children}</>;
}
