import { redirect } from "next/navigation";

export default function InterceptedSettingsIndexPage() {
  redirect("/settings/subscription");
}
