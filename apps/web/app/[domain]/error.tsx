"use client";

import { RouteError } from "@/components/route-error";

export default function DomainError(props: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <RouteError
      {...props}
      title="Couldn't load this report"
      description="Something went wrong loading this domain report. Please try again."
    />
  );
}
