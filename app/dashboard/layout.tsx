import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export const metadata = {
  title: "Dashboard | DomainStack",
  description: "Manage your tracked domains and notification settings.",
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side auth check
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  return <div className="container mx-auto px-4 py-8">{children}</div>;
}
