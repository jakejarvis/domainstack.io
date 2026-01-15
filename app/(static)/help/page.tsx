import type { Metadata } from "next";
import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PLAN_QUOTAS } from "@/lib/constants/plan-quotas";
import { PRO_TIER_INFO } from "@/lib/polar/products";

export const metadata: Metadata = {
  title: "Help & FAQ",
  description:
    "Get answers to common questions about Domainstack, domain tracking, notifications, and more.",
};

const faqSections = [
  {
    title: "Getting Started",
    items: [
      {
        question: "What is Domainstack?",
        answer: (
          <p>
            Domainstack is a domain intelligence platform that lets you look up
            detailed information about any domain and track domains you own.
            Enter any domain name to instantly see registration details, DNS
            records, SSL certificates, hosting information, and more. Sign up
            for free to begin receiving notifications about critical changes and
            upcoming expirations for your domains.
          </p>
        ),
      },
      {
        question: "Do I need an account to use Domainstack?",
        answer: (
          <p>
            Nope! You can look up any domain and view its full report without
            signing in. An account is only required if you want to track domains
            you own and receive expiration notifications. Sign up is free and
            uses GitHub for authentication.
          </p>
        ),
      },
    ],
  },
  {
    title: "Domain Reports",
    items: [
      {
        question: "What information is shown on a domain report?",
        answer: (
          <>
            <p>Each domain report includes:</p>
            <ul className="my-2">
              <li>
                <strong>Registration data</strong> — Registrar, creation date,
                expiration date, and WHOIS/RDAP information
              </li>
              <li>
                <strong>DNS records</strong> — A, AAAA, MX, TXT, NS, CNAME, and
                other record types
              </li>
              <li>
                <strong>SSL/TLS certificates</strong> — Issuer, validity period,
                and certificate chain
              </li>
              <li>
                <strong>HTTP headers</strong> — Server type, security headers,
                and caching policies
              </li>
              <li>
                <strong>Hosting provider</strong> — Who&apos;s serving the
                website based on IP and infrastructure
              </li>
              <li>
                <strong>SEO metadata</strong> — Title, description, and Open
                Graph tags
              </li>
              <li>
                <strong>Live screenshot</strong> — A visual preview of the
                website
              </li>
            </ul>
          </>
        ),
      },
      {
        question: "Where does the domain data come from?",
        answer: (
          <p>
            All domain data is gathered from publicly available sources. We
            query RDAP and WHOIS servers for registration info, perform DNS
            lookups against public resolvers, initiate TLS handshakes to inspect
            certificates, and make HTTP requests to analyze headers and capture
            screenshots. We don&apos;t access any private data.
          </p>
        ),
      },
      {
        question: "How often is domain data refreshed?",
        answer: (
          <p>
            Domain data is cached to ensure fast load times. Different data
            types have different refresh intervals — DNS records update more
            frequently than registration data, for example.
          </p>
        ),
      },
      {
        question: "Can I share a domain report?",
        answer: (
          <p>
            Yes! Every domain has its own public URL (like{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
              domainstack.io/example.com
            </code>
            ) that you can share with anyone. No account is required to view
            reports.
          </p>
        ),
      },
    ],
  },
  {
    title: "Domain Tracking",
    items: [
      {
        question: "How do I track a domain?",
        answer: (
          <p>
            From your dashboard, click "Add Domain" and enter the domain name
            you want to track. You&apos;ll need to verify ownership before
            tracking becomes active. Once verified, we&apos;ll monitor the
            domain and send you notifications about critical changes (like DNS
            updates) and before it or its certificate expires.
          </p>
        ),
      },
      {
        question: "How do I verify domain ownership?",
        answer: (
          <>
            <p>
              We offer three verification methods — use whichever is easiest for
              you:
            </p>
            <ul className="my-2">
              <li>
                <strong>DNS TXT record</strong> — Add a TXT record to your apex
                domain
              </li>
              <li>
                <strong>HTML file</strong> — Upload a verification file to{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
                  /.well-known/domainstack-verify.html
                </code>
              </li>
              <li>
                <strong>Meta tag</strong> — Add a{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
                  domainstack-verify
                </code>{" "}
                meta tag to your homepage
              </li>
            </ul>
            <p>
              Detailed instructions with your unique verification token are
              shown when you add a domain.
            </p>
          </>
        ),
      },
      {
        question: "How long do I have to verify a domain?",
        answer: (
          <p>
            You have 30&nbsp;days to verify a domain after adding it. We&apos;ll
            automatically attempt to verify your domain periodically, so once
            you&apos;ve set up verification, it should be detected within
            minutes.
          </p>
        ),
      },
      {
        question: "What happens if my verification fails?",
        answer: (
          <p>
            If you&apos;ve already verified a domain but we can no longer detect
            your verification record, you&apos;ll receive an email and have a
            7&#8209;day grace period to fix it. If verification isn&apos;t
            restored within that window, tracking will be revoked and
            you&apos;ll need to re-verify.
          </p>
        ),
      },
      {
        question: "What is the difference between active and archived domains?",
        answer: (
          <p>
            Active domains count toward your tracking limit and receive
            notifications. Archived domains are paused — they don&apos;t count
            against your limit and won&apos;t trigger notifications. You can
            archive domains you&apos;re not actively managing and reactivate
            them anytime.
          </p>
        ),
      },
    ],
  },
  {
    title: "Notifications",
    items: [
      {
        question: "What notifications will I receive?",
        answer: (
          <>
            <p>We send email notifications for:</p>
            <ul className="my-2">
              <li>
                <strong>Domain expiration</strong> — 30, 14, 7, and 1&nbsp;day
                before your domain expires
              </li>
              <li>
                <strong>Certificate expiration</strong> — 14, 7, 3, and
                1&nbsp;day before your SSL certificate expires
              </li>
              <li>
                <strong>Change detection</strong> — Updates to registration
                details, DNS providers, hosting, or email providers
              </li>
              <li>
                <strong>Verification status</strong> — When verification starts
                failing or is revoked
              </li>
            </ul>
          </>
        ),
      },
      {
        question: "Can I customize notifications for specific domains?",
        answer: (
          <p>
            Yes! Each tracked domain has its own notification settings. You can
            override global preferences on a per-domain basis — for example,
            disable certificate alerts for a domain that handles its own renewal
            while keeping domain expiry and change alerts enabled.
          </p>
        ),
      },
      {
        question: "How do I disable notifications?",
        answer: (
          <p>
            Go to <Link href="/settings">your settings</Link> to toggle
            notification categories on or off globally. You can disable domain
            expiration alerts, certificate expiration alerts, or verification
            status alerts independently.
          </p>
        ),
      },
    ],
  },
  {
    title: "Pricing & Limits",
    items: [
      {
        question: "How many domains can I track?",
        answer: (
          <p>
            Free accounts can track up to {PLAN_QUOTAS.free} domains. Pro
            subscribers can track up to {PLAN_QUOTAS.pro} domains. Archived
            domains don&apos;t count toward these limits.
          </p>
        ),
      },
      {
        question: "What's included in Pro?",
        answer: (
          <>
            <p>The Pro plan includes the following benefits:</p>
            <ul className="my-2">
              <li>
                Track up to {PLAN_QUOTAS.pro} domains (increased from{" "}
                {PLAN_QUOTAS.free})
              </li>
              <li>Priority email notifications</li>
              <li>Support ongoing development of Domainstack</li>
            </ul>
            <p>
              Pro is available for {PRO_TIER_INFO.monthly.label} or{" "}
              {PRO_TIER_INFO.yearly.label} ({PRO_TIER_INFO.yearly.savings}).
            </p>
          </>
        ),
      },
      {
        question: "What happens if I downgrade from Pro?",
        answer: (
          <p>
            If you cancel your Pro subscription, you&apos;ll keep Pro access
            until the end of your billing period. After that, if you have more
            than {PLAN_QUOTAS.free} active domains, the oldest ones will be
            automatically archived to fit within the free tier limit. You can
            manually choose which domains to archive before the downgrade takes
            effect.
          </p>
        ),
      },
      {
        question: "Can I cancel my subscription anytime?",
        answer: (
          <p>
            Yes, you can cancel anytime from your dashboard settings.
            You&apos;ll continue to have Pro access until the end of your
            current billing period — we don&apos;t prorate or issue partial
            refunds, but you won&apos;t be charged again.
          </p>
        ),
      },
    ],
  },
  {
    title: "Privacy & Security",
    items: [
      {
        question: "What data does Domainstack collect?",
        answer: (
          <p>
            We collect your account information (name and email via your chosen
            login provider), the domains you choose to track, and basic usage
            analytics. Domain data shown in reports is all publicly available
            information — we don&apos;t access anything private. See our{" "}
            <Link href="/privacy">Privacy Policy</Link> for full details.
          </p>
        ),
      },
      {
        question: "Is my data shared with third parties?",
        answer: (
          <p>
            We never sell your personal information. We only share data with
            service providers necessary to operate Domainstack (hosting, email
            delivery, payment processing). See our{" "}
            <Link href="/privacy">Privacy Policy</Link> for a complete list of
            our partners.
          </p>
        ),
      },
    ],
  },
  {
    title: "Account",
    items: [
      {
        question: "How do I sign up?",
        answer: (
          <p>
            Click "Sign in" in the header (or{" "}
            <Link href="/login">click here</Link>) and authenticate with one of
            the supported services. We use OAuth so you don&apos;t need to worry
            about a password. You can always change your linked account later in
            Settings.
          </p>
        ),
      },
      {
        question: "How do I delete my account?",
        answer: (
          <p>
            Go to your dashboard settings and scroll to the "Danger Zone"
            section. Click "Delete Account" and confirm to permanently remove
            your account and all associated data. This action cannot be undone.
          </p>
        ),
      },
    ],
  },
];

export default function HelpPage() {
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
        <div className="space-y-8">
          {faqSections.map((section) => (
            <div key={section.title}>
              <h2 className="mb-4">{section.title}</h2>
              <Accordion className="w-full rounded-lg border border-border/50 bg-muted/20">
                {section.items.map((item) => (
                  <AccordionItem
                    key={item.question}
                    value={item.question}
                    className="border-border/30 border-b px-4 last:border-none"
                  >
                    <AccordionTrigger className="cursor-pointer text-left tracking-[0.01em] decoration-muted-foreground/50 hover:text-foreground/90 hover:underline hover:underline-offset-4">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="pt-1 text-foreground/90">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ))}
        </div>
      </section>

      <section id="contact">
        <h2>Still have questions?</h2>
        <p>
          If you couldn&apos;t find what you&apos;re looking for, reach out to{" "}
          <a href="mailto:support@domainstack.io">support@domainstack.io</a>.
        </p>
      </section>
    </>
  );
}
