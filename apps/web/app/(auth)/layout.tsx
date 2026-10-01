import { Suspense } from "react";

import { LoginSkeletonWithCard } from "@/components/auth/login-skeleton";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Suspense fallback={<LoginSkeletonWithCard />}>{children}</Suspense>
    </div>
  );
}
