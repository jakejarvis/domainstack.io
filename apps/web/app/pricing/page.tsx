import type { Metadata } from "next";
import Link from "next/link";

import { PricingCta } from "@/components/pricing/pricing-cta";
import { PLAN_QUOTAS } from "@domainstack/constants";
import { PRO_TIER_INFO } from "@domainstack/polar/products";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@domainstack/ui/accordion";

export const metadata: Metadata = {
  title: "Pricing",
  description: `Domainstack Pro: track up to ${PLAN_QUOTAS.pro} domains for ${PRO_TIER_INFO.monthly.label} or ${PRO_TIER_INFO.yearly.label}. Free accounts include ${PLAN_QUOTAS.free} tracked domains.`,
  alternates: {
    canonical: "/pricing",
  },
};

const faqItems = [
  {
    question: "How many domains can I track?",
    answer: (
      <p>
        Free accounts can track up to {PLAN_QUOTAS.free} domains. Pro subscribers can track up to{" "}
        {PLAN_QUOTAS.pro} domains. Archived domains don&apos;t count toward these limits.
      </p>
    ),
  },
  {
    question: "What's included in Pro?",
    answer: (
      <>
        <p>The Pro plan includes the following benefits:</p>
        <ul>
          <li>
            Track up to {PLAN_QUOTAS.pro} domains (increased from {PLAN_QUOTAS.free})
          </li>
          <li>Priority email notifications</li>
          <li>Support ongoing development of Domainstack</li>
        </ul>
        <p>
          Pro is available for {PRO_TIER_INFO.monthly.label} or {PRO_TIER_INFO.yearly.label} (
          {PRO_TIER_INFO.yearly.savings}).
        </p>
      </>
    ),
  },
  {
    question: "What happens if I downgrade from Pro?",
    answer: (
      <>
        <p>
          If you cancel your Pro subscription, you&apos;ll keep Pro access until the end of your
          billing period.
        </p>
        <p>
          After that, if you have more than {PLAN_QUOTAS.free} active domains, the oldest ones will
          be automatically archived to fit within the free tier limit. You can manually choose which
          domains to archive before the downgrade takes effect.
        </p>
      </>
    ),
  },
  {
    question: "Can I cancel my subscription anytime?",
    answer: (
      <>
        <p>
          Yes, you can cancel anytime from your dashboard settings. You&apos;ll continue to have Pro
          access until the end of your current billing period.
        </p>
        <p>We don&apos;t prorate or issue partial refunds, but you won&apos;t be charged again.</p>
      </>
    ),
  },
];

export default function PricingPage() {
  return (
    <div className="space-y-12 md:space-y-16">
      <header className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-medium tracking-wide text-accent-gold uppercase">
          {PRO_TIER_INFO.name}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl md:text-5xl">
          Track {PLAN_QUOTAS.pro} domains, not {PLAN_QUOTAS.free}.
        </h1>
        <p className="mt-4 flex flex-wrap items-baseline justify-center gap-x-1.5 text-base text-muted-foreground sm:text-lg">
          <span className="font-semibold text-accent-gold">{PRO_TIER_INFO.monthly.label}</span>
          <span>or</span>
          <span className="font-semibold text-accent-gold">{PRO_TIER_INFO.yearly.label}</span>
          <span className="text-sm lowercase">({PRO_TIER_INFO.yearly.savings})</span>
        </p>
      </header>

      <section aria-labelledby="pro-plan-heading">
        <h2 id="pro-plan-heading" className="sr-only">
          {PRO_TIER_INFO.name} plan
        </h2>
        <div className="relative mx-auto max-w-lg overflow-hidden rounded-xl border border-black/10 bg-background/80 p-6 shadow-xl backdrop-blur-xl sm:p-8 dark:border-white/10">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-16 -right-12 size-56 rounded-full bg-accent-gold/15 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-12 -left-10 size-40 rounded-full bg-accent-gold-muted/20 blur-3xl"
          />

          <div className="relative space-y-8">
            <div className="flex items-end justify-between gap-6">
              <div className="min-w-0">
                <p className="text-7xl leading-none font-semibold tracking-tight text-accent-gold sm:text-8xl">
                  {PLAN_QUOTAS.pro}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">tracked domains</p>
              </div>
              <p className="mb-1 shrink-0 text-sm text-muted-foreground">
                {PLAN_QUOTAS.free} on Free
              </p>
            </div>

            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Priority email notifications</li>
              <li>Support ongoing development</li>
            </ul>

            <PricingCta />
          </div>
        </div>
      </section>

      <p className="text-center text-sm text-muted-foreground">
        Free includes {PLAN_QUOTAS.free} domains. Cancel anytime.
      </p>

      <section id="faq" className="mx-auto max-w-2xl scroll-mt-24">
        <h2 className="mb-4 text-lg font-semibold tracking-tight">Questions</h2>
        <Accordion className="w-full rounded-lg border border-black/10 bg-muted/20 dark:border-white/10">
          {faqItems.map((item) => (
            <AccordionItem
              key={item.question}
              value={item.question}
              className="border-b border-border px-4 last:border-none"
            >
              <AccordionTrigger className="text-left tracking-[0.01em] text-foreground decoration-muted-foreground/50 hover:text-foreground/90 hover:underline hover:underline-offset-4">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="space-y-3 text-sm text-foreground/90 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-4">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        <p className="mt-4 text-sm text-muted-foreground">
          See{" "}
          <Link href="/help" className="text-foreground/85 underline underline-offset-2">
            Help
          </Link>{" "}
          for more details.
        </p>
      </section>
    </div>
  );
}
