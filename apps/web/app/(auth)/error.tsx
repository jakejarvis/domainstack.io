"use client";

import { RouteError } from "@/components/route-error";

export default function AuthError(props: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <RouteError
      {...props}
      title="Couldn't load sign-in"
      description="Something went wrong loading the sign-in page. Please try again."
    />
  );
}
