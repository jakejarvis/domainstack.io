"use client";

import { RouteError } from "@/components/route-error";

export default function DashboardError(props: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <RouteError
      {...props}
      title="Couldn't load your dashboard"
      description="Something went wrong loading your tracked domains. Please try again."
    />
  );
}
