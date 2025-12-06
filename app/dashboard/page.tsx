"use client";

import { NuqsAdapter } from "nuqs/adapters/next/app";
import { DashboardContent } from "@/components/dashboard/dashboard-content";

export default function DashboardPage() {
  return (
    <NuqsAdapter>
      <DashboardContent />
    </NuqsAdapter>
  );
}
