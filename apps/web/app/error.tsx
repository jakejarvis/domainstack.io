"use client";

import { RouteError } from "@/components/route-error";

export default function RootError(props: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <RouteError {...props} />;
}
