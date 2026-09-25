"use client";

import { useLinkStatus } from "next/link";

import { Spinner } from "@domainstack/ui/spinner";

/**
 * An icon that turns into a spinner while its enclosing `<Link>` navigates.
 * Must render inside the Link. Shows nothing extra when the route was already
 * prefetched, since that navigation is instant.
 */
export function LinkPendingIcon({ icon }: { icon: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return pending ? <Spinner /> : icon;
}
