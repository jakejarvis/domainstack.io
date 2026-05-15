import { IconExternalLink } from "@tabler/icons-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms and conditions for using Domainstack's domain intelligence platform.",
};

export default function TermsPage() {
  return (
    <>
      <header className="not-prose">
        <h1 className="text-2xl font-semibold tracking-tight">Terms of Service</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Last updated: May 15, 2026
        </p>
      </header>

      <section id="acceptance-of-terms">
        <h2>Acceptance of Terms</h2>
        <p>
          By accessing or using Domainstack ("the Service"), you agree to be bound by these Terms of
          Service. If you do not agree to these terms, please do not use the Service.
        </p>
      </section>

      <section id="description-of-service">
        <h2>Description of Service</h2>
        <p>
          Domainstack is a domain intelligence platform that provides information about domain
          registrations, DNS records, SSL certificates, hosting details, and SEO metadata. The
          Service is available through our website and our iOS and Android mobile apps, and allows
          users to:
        </p>
        <ul>
          <li>Look up publicly available domain information</li>
          <li>Track domains and receive expiration notifications by email or push notification</li>
          <li>Monitor SSL certificate validity</li>
          <li>View hosting and DNS provider information</li>
        </ul>
      </section>

      <section id="account-registration">
        <h2>Account Registration</h2>
        <p>
          To access certain features, you must create an account using one of our supported sign-in
          providers (such as GitHub, GitLab, Google, Vercel, or Apple). On our mobile apps you may
          sign in natively with Apple or Google. You agree to:
        </p>
        <ul>
          <li>Provide accurate and complete information</li>
          <li>Maintain the security of your account</li>
          <li>Accept responsibility for all activities under your account</li>
          <li>Notify us immediately of any unauthorized access</li>
        </ul>
      </section>

      <section id="mobile-applications">
        <h2>Mobile Applications</h2>
        <p>
          Our iOS and Android apps are distributed through the Apple App Store and Google Play. Your
          use of an app is also subject to the applicable app store&apos;s terms of service, and you
          agree to comply with them.
        </p>

        <h3>Push Notifications</h3>
        <p>
          The apps can send push notifications. You may grant or revoke notification permission at
          any time from your device settings, and you can manage notification categories in your
          account settings. Notification delivery depends on Apple and Google and is not guaranteed.
        </p>

        <h3>Apple App Store</h3>
        <p>
          If you download the app from the Apple App Store, the following additional terms apply.
          You acknowledge and agree that:
        </p>
        <ul>
          <li>
            These Terms are between you and Domainstack only, and not with Apple. Apple is not
            responsible for the app or its content.
          </li>
          <li>
            Apple has no obligation to furnish any maintenance or support services for the app.
          </li>
          <li>
            In the event of any failure of the app to conform to any applicable warranty, you may
            notify Apple, and Apple will refund any applicable purchase price for the app; to the
            maximum extent permitted by law, Apple has no other warranty obligation with respect to
            the app.
          </li>
          <li>
            Apple is not responsible for addressing any claims by you or any third party relating to
            the app, including product liability, regulatory, or intellectual property claims.
          </li>
          <li>
            Apple and its subsidiaries are third-party beneficiaries of these Terms and, upon your
            acceptance, will have the right to enforce these Terms against you.
          </li>
          <li>
            You represent that you are not located in a country subject to a U.S. Government embargo
            and are not listed on any U.S. Government prohibited or restricted-parties list.
          </li>
        </ul>

        <h3>No In-App Purchases</h3>
        <p>
          The apps do not sell digital goods or subscriptions. Pro subscriptions are purchased and
          managed only through our website (see Paid Subscriptions below).
        </p>
      </section>

      <section id="acceptable-use">
        <h2>Acceptable Use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use the Service for any illegal purpose</li>
          <li>Attempt to gain unauthorized access to any part of the Service</li>
          <li>Use automated tools to excessively query the Service (scraping)</li>
          <li>Interfere with or disrupt the Service or its infrastructure</li>
          <li>Impersonate others or misrepresent your affiliation</li>
          <li>Use the Service to harass, abuse, or harm others</li>
        </ul>
      </section>

      <section id="domain-verification">
        <h2>Domain Verification</h2>
        <p>
          When tracking domains, you may be required to verify ownership through DNS records, HTML
          files, or meta tags. You represent that:
        </p>
        <ul>
          <li>You have the right to verify ownership of domains you add</li>
          <li>You will not attempt to verify domains you do not own or control</li>
          <li>Verification is for notification purposes and does not transfer any rights</li>
        </ul>
      </section>

      <section id="ai-assistant">
        <h2>AI Assistant</h2>
        <p>
          We provide an optional AI-powered chat assistant to help you look up domain information
          using natural language. By using this feature, you acknowledge and agree to the following:
        </p>

        <h3>Intended Use</h3>
        <ul>
          <li>The AI assistant is designed solely for domain-related queries</li>
          <li>
            It can look up WHOIS/RDAP records, DNS records, SSL certificates, hosting information,
            and SEO metadata
          </li>
          <li>The assistant will decline requests unrelated to domain information</li>
        </ul>

        <h3>Limitations and Disclaimers</h3>
        <ul>
          <li>
            <strong>AI responses may contain errors.</strong> The assistant uses large language
            models that can make mistakes, misinterpret queries, or provide incomplete information
          </li>
          <li>
            <strong>Not a substitute for professional advice.</strong> Do not rely on the AI
            assistant for legal, financial, or security decisions regarding domains
          </li>
          <li>
            <strong>Third-party data.</strong> Information retrieved by the assistant comes from
            public sources and may not be current or accurate
          </li>
          <li>
            <strong>No guarantee of availability.</strong> The AI feature may be modified,
            suspended, or discontinued at any time
          </li>
        </ul>

        <h3>Acceptable Use</h3>
        <p>You agree not to:</p>
        <ul>
          <li>Attempt to manipulate, jailbreak, or bypass the assistant&apos;s guidelines</li>
          <li>Use the assistant to generate harmful, abusive, or illegal content</li>
          <li>Excessively query the assistant to circumvent rate limits</li>
          <li>Use automated tools to interact with the AI assistant</li>
        </ul>

        <h3>Rate Limits</h3>
        <p>
          To ensure fair access for all users, the AI assistant is subject to rate limits. Free
          users have lower limits than authenticated users. Exceeding these limits will temporarily
          restrict access.
        </p>
      </section>

      <section id="data-accuracy">
        <h2>Data Accuracy</h2>
        <p>
          The Service provides information from various public sources including WHOIS/RDAP
          databases, DNS servers, and website content. While we strive for accuracy:
        </p>
        <ul>
          <li>We do not guarantee the accuracy of third-party data</li>
          <li>Information may be cached and not reflect real-time changes</li>
          <li>You should independently verify critical information before making decisions</li>
        </ul>
      </section>

      <section id="service-tiers-and-limits">
        <h2>Service Tiers and Limits</h2>
        <p>
          The Service offers a free tier and a paid Pro tier with different limits on tracked
          domains and features:
        </p>
        <ul>
          <li>
            <strong>Free tier:</strong> Limited number of tracked domains
          </li>
          <li>
            <strong>Pro tier:</strong> Increased domain tracking limits and priority support
          </li>
        </ul>
        <p>We reserve the right to:</p>
        <ul>
          <li>Modify service tiers and their features with reasonable notice</li>
          <li>Adjust usage limits with reasonable notice</li>
          <li>Change pricing with 30 days notice to existing subscribers</li>
        </ul>
      </section>

      <section id="paid-subscriptions">
        <h2>Paid Subscriptions</h2>
        <p>
          Pro subscriptions are purchased and managed through our website and are billed on a
          recurring basis (monthly or annually) through our payment partners. Subscriptions are not
          sold through the mobile apps or the Apple App Store or Google Play, and your subscription
          applies to your account across the website and apps.
        </p>

        <h3>Payment Processing</h3>
        <p>
          Payments are processed by{" "}
          <a href="https://polar.sh" target="_blank" rel="noopener noreferrer">
            Polar
            <IconExternalLink />
          </a>{" "}
          (our merchant of record) and{" "}
          <a href="https://stripe.com" target="_blank" rel="noopener noreferrer">
            Stripe
            <IconExternalLink />
          </a>{" "}
          (payment infrastructure). By subscribing, you also agree to:
        </p>
        <ul>
          <li>
            <a href="https://polar.sh/legal/terms" target="_blank" rel="noopener noreferrer">
              Polar&apos;s Terms of Service
              <IconExternalLink />
            </a>
          </li>
          <li>
            <a href="https://stripe.com/legal/consumer" target="_blank" rel="noopener noreferrer">
              Stripe&apos;s Consumer Terms
              <IconExternalLink />
            </a>
          </li>
        </ul>

        <h3>Billing and Renewal</h3>
        <ul>
          <li>Subscriptions automatically renew unless cancelled</li>
          <li>You will be charged at the start of each billing period</li>
          <li>Price changes will be communicated 30 days before they take effect</li>
        </ul>

        <h3>Cancellation</h3>
        <ul>
          <li>You may cancel your subscription at any time</li>
          <li>Cancellation takes effect at the end of the current billing period</li>
          <li>You retain Pro access until the end of your paid period</li>
          <li>
            Upon downgrade, domains exceeding the free tier limit will be archived (not deleted)
          </li>
        </ul>

        <h3>Refunds</h3>
        <p>
          Refund requests are handled on a case-by-case basis. Please contact us within 14 days of
          your charge if you believe a refund is warranted. We reserve the right to deny refunds for
          extended use of the Service.
        </p>
      </section>

      <section id="intellectual-property">
        <h2>Intellectual Property</h2>
        <p>
          The Service and its original content, features, and functionality are owned by Domainstack
          and are protected by copyright, trademark, and other intellectual property laws. Domain
          data displayed is sourced from public databases and remains the property of respective
          registries.
        </p>
      </section>

      <section id="disclaimer-of-warranties">
        <h2>Disclaimer of Warranties</h2>
        <p>
          THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS
          OR IMPLIED. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR
          SECURE.
        </p>
      </section>

      <section id="limitation-of-liability">
        <h2>Limitation of Liability</h2>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, DOMAINSTACK SHALL NOT BE LIABLE FOR ANY INDIRECT,
          INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE
          SERVICE, INCLUDING BUT NOT LIMITED TO LOSS OF DATA, REVENUE, OR BUSINESS OPPORTUNITIES.
        </p>
      </section>

      <section id="termination">
        <h2>Termination</h2>
        <p>
          We may terminate or suspend your account at any time for violation of these terms or for
          any other reason at our discretion. Upon termination, your right to use the Service will
          cease immediately.
        </p>
      </section>

      <section id="changes-to-terms">
        <h2>Changes to Terms</h2>
        <p>
          We reserve the right to modify these terms at any time. We will notify users of
          significant changes via email or through the Service. Continued use after changes
          constitutes acceptance of the new terms.
        </p>
      </section>

      <section id="governing-law">
        <h2>Governing Law</h2>
        <p>
          These terms shall be governed by and construed in accordance with the laws of the United
          States, without regard to conflict of law principles.
        </p>
      </section>

      <section id="contact">
        <h2>Contact</h2>
        <p>
          For questions about these Terms of Service, please contact us at{" "}
          <a href="mailto:legal@domainstack.io">legal@domainstack.io</a>.
        </p>
      </section>
    </>
  );
}
