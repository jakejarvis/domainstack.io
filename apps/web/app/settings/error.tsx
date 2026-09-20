"use client";

import { RouteError } from "@/components/route-error";

export default function SettingsError(props: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <RouteError
      {...props}
      title="Couldn't load settings"
      description="Something went wrong loading your settings. Please try again."
    />
  );
}
