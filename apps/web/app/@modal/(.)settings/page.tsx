import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Settings",
  description: "Account, subscription, and notification settings.",
};

export default function InterceptedSettingsIndexPage() {
  redirect("/settings/subscription");
}
