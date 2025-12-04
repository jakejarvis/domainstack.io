import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms and conditions for using Domainstack's domain intelligence platform.",
};

export default function TermsPage() {
  return (
    <>
      <header className="mb-8 border-border/50 border-b pb-8">
        <h1>Terms of Service</h1>
        <p className="mt-2 text-muted-foreground text-sm">
          Last updated: December 4, 2025
        </p>
      </header>

      <section>
        <h2>Acceptance of Terms</h2>
        <p>
          By accessing or using Domainstack (&quot;the Service&quot;), you agree
          to be bound by these Terms of Service. If you do not agree to these
          terms, please do not use the Service.
        </p>
      </section>

      <section>
        <h2>Description of Service</h2>
        <p>
          Domainstack is a domain intelligence platform that provides
          information about domain registrations, DNS records, SSL certificates,
          hosting details, and SEO metadata. The Service allows users to:
        </p>
        <ul>
          <li>Look up publicly available domain information</li>
          <li>Track domains and receive expiration notifications</li>
          <li>Monitor SSL certificate validity</li>
          <li>View hosting and DNS provider information</li>
        </ul>
      </section>

      <section>
        <h2>Account Registration</h2>
        <p>
          To access certain features, you must create an account using GitHub
          OAuth. You agree to:
        </p>
        <ul>
          <li>Provide accurate and complete information</li>
          <li>Maintain the security of your account</li>
          <li>Accept responsibility for all activities under your account</li>
          <li>Notify us immediately of any unauthorized access</li>
        </ul>
      </section>

      <section>
        <h2>Acceptable Use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use the Service for any illegal purpose</li>
          <li>
            Attempt to gain unauthorized access to any part of the Service
          </li>
          <li>
            Use automated tools to excessively query the Service (scraping)
          </li>
          <li>Interfere with or disrupt the Service or its infrastructure</li>
          <li>Impersonate others or misrepresent your affiliation</li>
          <li>Use the Service to harass, abuse, or harm others</li>
        </ul>
      </section>

      <section>
        <h2>Domain Verification</h2>
        <p>
          When tracking domains, you may be required to verify ownership through
          DNS records, HTML files, or meta tags. You represent that:
        </p>
        <ul>
          <li>You have the right to verify ownership of domains you add</li>
          <li>
            You will not attempt to verify domains you do not own or control
          </li>
          <li>
            Verification is for notification purposes and does not transfer any
            rights
          </li>
        </ul>
      </section>

      <section>
        <h2>Data Accuracy</h2>
        <p>
          The Service provides information from various public sources including
          WHOIS/RDAP databases, DNS servers, and website content. While we
          strive for accuracy:
        </p>
        <ul>
          <li>We do not guarantee the accuracy of third-party data</li>
          <li>Information may be cached and not reflect real-time changes</li>
          <li>
            You should independently verify critical information before making
            decisions
          </li>
        </ul>
      </section>

      <section>
        <h2>Service Tiers and Limits</h2>
        <p>
          The Service may offer different tiers with varying limits on tracked
          domains and features. We reserve the right to:
        </p>
        <ul>
          <li>Modify service tiers and their features</li>
          <li>Adjust usage limits with reasonable notice</li>
          <li>Introduce paid features in the future</li>
        </ul>
      </section>

      <section>
        <h2>Intellectual Property</h2>
        <p>
          The Service and its original content, features, and functionality are
          owned by Domainstack and are protected by copyright, trademark, and
          other intellectual property laws. Domain data displayed is sourced
          from public databases and remains the property of respective
          registries.
        </p>
      </section>

      <section>
        <h2>Disclaimer of Warranties</h2>
        <p>
          THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot;
          WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. WE DO NOT WARRANT
          THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE.
        </p>
      </section>

      <section>
        <h2>Limitation of Liability</h2>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, DOMAINSTACK SHALL NOT BE
          LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
          PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE SERVICE, INCLUDING BUT
          NOT LIMITED TO LOSS OF DATA, REVENUE, OR BUSINESS OPPORTUNITIES.
        </p>
      </section>

      <section>
        <h2>Termination</h2>
        <p>
          We may terminate or suspend your account at any time for violation of
          these terms or for any other reason at our discretion. Upon
          termination, your right to use the Service will cease immediately.
        </p>
      </section>

      <section>
        <h2>Changes to Terms</h2>
        <p>
          We reserve the right to modify these terms at any time. We will notify
          users of significant changes via email or through the Service.
          Continued use after changes constitutes acceptance of the new terms.
        </p>
      </section>

      <section>
        <h2>Governing Law</h2>
        <p>
          These terms shall be governed by and construed in accordance with the
          laws of the United States, without regard to conflict of law
          principles.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          For questions about these Terms of Service, please contact us at{" "}
          <a href="mailto:legal@domainstack.io">legal@domainstack.io</a>.
        </p>
      </section>

      <footer className="mt-12 border-border/50 border-t pt-8 text-sm">
        <p>
          See also our <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </footer>
    </>
  );
}
