import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type FaqItem = {
  question: string;
  answer: React.ReactNode;
};

type FaqSection = {
  title: string;
  items: FaqItem[];
};

type TierLimits = {
  free: number;
  pro: number;
};

type PricingInfo = {
  monthlyLabel: string;
  yearlyLabel: string;
  yearlySavings: string;
};

function createFaqSections(
  limits: TierLimits,
  pricing: PricingInfo,
): FaqSection[] {
  return [
    {
      title: "Getting Started",
      items: [
        {
          question: "What is Domainstack?",
          answer: (
            <>
              Domainstack is a domain intelligence platform that lets you look
              up detailed information about any domain and track domains you
              own. Enter any domain name to instantly see registration details,
              DNS records, SSL certificates, hosting information, and more. Sign
              up for free to begin receiving notifications about critical
              changes and upcoming expirations for your domains.
            </>
          ),
        },
        {
          question: "Do I need an account to use Domainstack?",
          answer: (
            <>
              Nope! You can look up any domain and view its full report without
              signing in. An account is only required if you want to track
              domains you own and receive expiration notifications. Sign up is
              free and uses GitHub for authentication.
            </>
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
              Each domain report includes:
              <ul className="mt-2 list-disc space-y-1 pl-6">
                <li>
                  <strong>Registration data</strong> — Registrar, creation date,
                  expiration date, and WHOIS/RDAP information
                </li>
                <li>
                  <strong>DNS records</strong> — A, AAAA, MX, TXT, NS, CNAME,
                  and other record types
                </li>
                <li>
                  <strong>SSL/TLS certificates</strong> — Issuer, validity
                  period, and certificate chain
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
            <>
              All domain data is gathered from publicly available sources. We
              query RDAP and WHOIS servers for registration info, perform DNS
              lookups against public resolvers, initiate TLS handshakes to
              inspect certificates, and make HTTP requests to analyze headers
              and capture screenshots. We don&apos;t access any private data.
            </>
          ),
        },
        {
          question: "How often is domain data refreshed?",
          answer: (
            <>
              Domain data is cached to ensure fast load times. Different data
              types have different refresh intervals — DNS records update more
              frequently than registration data, for example.
            </>
          ),
        },
        {
          question: "Can I share a domain report?",
          answer: (
            <>
              Yes! Every domain has its own public URL (like{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
                domainstack.io/example.com
              </code>
              ) that you can share with anyone. No account is required to view
              reports.
            </>
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
            <>
              From your dashboard, click &quot;Add Domain&quot; and enter the
              domain name you want to track. You&apos;ll need to verify
              ownership before tracking becomes active. Once verified,
              we&apos;ll monitor the domain and send you notifications about
              critical changes (like DNS updates) and before it or its
              certificate expires.
            </>
          ),
        },
        {
          question: "How do I verify domain ownership?",
          answer: (
            <>
              We offer three verification methods — use whichever is easiest for
              you:
              <ul className="mt-2 list-disc space-y-1 pl-6">
                <li>
                  <strong>DNS TXT record</strong> — Add a TXT record to your
                  apex domain
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
              <p className="mt-2">
                Detailed instructions with your unique verification token are
                shown when you add a domain.
              </p>
            </>
          ),
        },
        {
          question: "How long do I have to verify a domain?",
          answer: (
            <>
              You have 30 days to verify a domain after adding it. We&apos;ll
              automatically attempt to verify your domain periodically, so once
              you&apos;ve set up verification, it should be detected within
              minutes.
            </>
          ),
        },
        {
          question: "What happens if my verification fails?",
          answer: (
            <>
              If you&apos;ve already verified a domain but we can no longer
              detect your verification record, you&apos;ll receive an email and
              have a 7-day grace period to fix it. If verification isn&apos;t
              restored within that window, tracking will be revoked and
              you&apos;ll need to re-verify.
            </>
          ),
        },
        {
          question:
            "What is the difference between active and archived domains?",
          answer: (
            <>
              Active domains count toward your tracking limit and receive
              notifications. Archived domains are paused — they don&apos;t count
              against your limit and won&apos;t trigger notifications. You can
              archive domains you&apos;re not actively managing and reactivate
              them anytime.
            </>
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
              We send email notifications for:
              <ul className="mt-2 list-disc space-y-1 pl-6">
                <li>
                  <strong>Domain expiration</strong> — 30, 14, 7, and 1 day
                  before your domain expires
                </li>
                <li>
                  <strong>Certificate expiration</strong> — 14, 7, 3, and 1 day
                  before your SSL certificate expires
                </li>
                <li>
                  <strong>Change detection</strong> — Updates to registration
                  details, DNS providers, hosting, or email providers
                </li>
                <li>
                  <strong>Verification status</strong> — When verification
                  starts failing or is revoked
                </li>
              </ul>
            </>
          ),
        },
        {
          question: "Can I customize notifications for specific domains?",
          answer: (
            <>
              Yes! Each tracked domain has its own notification settings. You
              can override global preferences on a per-domain basis — for
              example, disable certificate alerts for a domain that handles its
              own renewal while keeping domain expiry and change alerts enabled.
            </>
          ),
        },
        {
          question: "How do I disable notifications?",
          answer: (
            <>
              Go to your dashboard settings to toggle notification categories on
              or off globally. You can disable domain expiration alerts,
              certificate expiration alerts, or verification status alerts
              independently.
            </>
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
            <>
              Free accounts can track up to {limits.free} domains. Pro
              subscribers can track up to {limits.pro} domains. Archived domains
              don&apos;t count toward these limits.
            </>
          ),
        },
        {
          question: "What's included in Pro?",
          answer: (
            <>
              Pro includes:
              <ul className="mt-2 list-disc space-y-1 pl-6">
                <li>
                  Track up to {limits.pro} domains (vs {limits.free} on free)
                </li>
                <li>Priority email notifications</li>
                <li>Support ongoing development of Domainstack</li>
              </ul>
              <p className="mt-2">
                Pro is available for {pricing.monthlyLabel} or{" "}
                {pricing.yearlyLabel} ({pricing.yearlySavings}).
              </p>
            </>
          ),
        },
        {
          question: "What happens if I downgrade from Pro?",
          answer: (
            <>
              If you cancel your Pro subscription, you&apos;ll keep Pro access
              until the end of your billing period. After that, if you have more
              than {limits.free} active domains, the oldest ones will be
              automatically archived to fit within the free tier limit. You can
              manually choose which domains to archive before the downgrade
              takes effect.
            </>
          ),
        },
        {
          question: "Can I cancel my subscription anytime?",
          answer: (
            <>
              Yes, you can cancel anytime from your dashboard settings.
              You&apos;ll continue to have Pro access until the end of your
              current billing period — we don&apos;t prorate or issue partial
              refunds, but you won&apos;t be charged again.
            </>
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
            <>
              We collect your account information (name and email via your
              chosen login provider), the domains you choose to track, and basic
              usage analytics. Domain data shown in reports is all publicly
              available information — we don&apos;t access anything private. See
              our{" "}
              <Link href="/privacy" className="underline underline-offset-4">
                Privacy Policy
              </Link>{" "}
              for full details.
            </>
          ),
        },
        {
          question: "Is my data shared with third parties?",
          answer: (
            <>
              We never sell your personal information. We only share data with
              service providers necessary to operate Domainstack (hosting, email
              delivery, payment processing). See our{" "}
              <Link href="/privacy" className="underline underline-offset-4">
                Privacy Policy
              </Link>{" "}
              for a complete list.
            </>
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
            <>
              Click &quot;Sign in&quot; in the header (or{" "}
              <Link href="/login" className="underline underline-offset-4">
                click here
              </Link>
              ) and authenticate with one of the supported services. We use
              OAuth so you don&apos;t need to worry about a password. You can
              always change your linked account later in Settings.
            </>
          ),
        },
        {
          question: "How do I delete my account?",
          answer: (
            <>
              Go to your dashboard settings and scroll to the &quot;Danger
              Zone&quot; section. Click &quot;Delete Account&quot; and confirm
              to permanently remove your account and all associated data. This
              action cannot be undone.
            </>
          ),
        },
      ],
    },
  ];
}

type FaqAccordionProps = {
  tierLimits: TierLimits;
  pricing: PricingInfo;
};

export function FaqAccordion({ tierLimits, pricing }: FaqAccordionProps) {
  const faqSections = createFaqSections(tierLimits, pricing);

  return (
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
                <AccordionTrigger className="cursor-pointer text-left text-foreground tracking-[0.01em] decoration-muted-foreground/50 underline-offset-4 hover:text-foreground/85 hover:underline">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="pt-1 text-foreground/85">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      ))}
    </div>
  );
}
