import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { FaqAccordion } from "@/components/help/faq-accordion";
import { getTierLimits } from "@/lib/edge-config";
import { POLAR_PRODUCTS } from "@/lib/polar/products";

export const metadata: Metadata = {
  title: "Help & FAQ",
  description:
    "Get answers to common questions about Domainstack, domain tracking, notifications, and more.",
};

// Cache tier limits for 1 hour to preserve static nature of the page
const getCachedTierLimits = unstable_cache(
  async () => getTierLimits(),
  ["help-page-tier-limits"],
  { revalidate: 3600 },
);

// Static pricing info from constants
const pricing = {
  monthlyLabel: POLAR_PRODUCTS["pro-monthly"].label,
  yearlyLabel: POLAR_PRODUCTS["pro-yearly"].label,
  yearlySavings: POLAR_PRODUCTS["pro-yearly"].savings,
};

export default async function HelpPage() {
  const tierLimits = await getCachedTierLimits();

  return (
    <>
      <header className="mb-8 border-border/50 border-b pb-8">
        <h1>Help & FAQ</h1>
        <p className="mt-2 text-muted-foreground">
          Everything you need to know about using Domainstack.
        </p>
      </header>

      <section>
        <p>
          Domainstack helps you understand and monitor your domains. Look up any
          domain to see registration details, DNS records, SSL certificates, and
          more — all in one place. Track domains you own to get notified about
          critical changes and get a heads up before they're due to expire.
        </p>
      </section>

      <section>
        <FaqAccordion tierLimits={tierLimits} pricing={pricing} />
      </section>

      <section>
        <h2>Still have questions?</h2>
        <p>
          If you couldn&apos;t find what you&apos;re looking for, reach out to{" "}
          <a href="mailto:support@domainstack.io">support@domainstack.io</a>.
        </p>
      </section>
    </>
  );
}
