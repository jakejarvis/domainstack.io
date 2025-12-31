import type { Metadata } from "next";
import { headers } from "next/headers";
import { FeaturebaseWidget } from "@/components/featurebase-widget";
import { auth, type Session } from "@/lib/auth";
import { createFeaturebaseToken } from "@/lib/featurebase";

export const metadata: Metadata = {
  title: "Feedback",
  description: "Public feedback & suggestions forum for Domainstack.",
};

export default async function FeedbackPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const jwtToken = await createFeaturebaseToken(session as Session);

  return (
    <FeaturebaseWidget jwtToken={jwtToken} routeSyncingBasePath="/feedback" />
  );
}
