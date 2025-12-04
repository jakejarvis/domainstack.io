import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Learn how Domainstack collects, uses, and protects your personal information.",
};

export default function PrivacyPage() {
  return (
    <>
      <header className="mb-8 border-border/50 border-b pb-8">
        <h1>Privacy Policy</h1>
        <p className="mt-2 text-muted-foreground text-sm">
          Last updated: December 4, 2025
        </p>
      </header>

      <section>
        <h2>Introduction</h2>
        <p>
          Domainstack (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;)
          respects your privacy and is committed to protecting your personal
          data. This privacy policy explains how we collect, use, and safeguard
          your information when you use our domain intelligence platform.
        </p>
      </section>

      <section>
        <h2>Information We Collect</h2>

        <h3>Account Information</h3>
        <p>When you create an account, we collect:</p>
        <ul>
          <li>Name and email address (via GitHub OAuth)</li>
          <li>Profile picture (optional, from your GitHub account)</li>
        </ul>

        <h3>Domain Data</h3>
        <p>When you use our service, we collect and display:</p>
        <ul>
          <li>
            Domain registration and WHOIS information (publicly available)
          </li>
          <li>DNS records (publicly queryable)</li>
          <li>SSL/TLS certificate information (publicly available)</li>
          <li>HTTP headers and hosting information</li>
          <li>SEO metadata and screenshots of websites</li>
        </ul>

        <h3>Usage Data</h3>
        <p>We automatically collect:</p>
        <ul>
          <li>Pages viewed and features used</li>
          <li>Device and browser information</li>
          <li>IP address and approximate location</li>
        </ul>
      </section>

      <section>
        <h2>How We Use Your Information</h2>
        <p>We use your information to:</p>
        <ul>
          <li>Provide and maintain our service</li>
          <li>Send domain and certificate expiration notifications</li>
          <li>Improve and personalize your experience</li>
          <li>Communicate important updates about our service</li>
          <li>Detect and prevent fraud or abuse</li>
        </ul>
      </section>

      <section>
        <h2>Data Retention</h2>
        <p>
          We retain your account information for as long as your account is
          active. Domain data is cached temporarily to improve performance and
          is refreshed periodically. You can delete your account at any time,
          which will remove your personal data from our systems.
        </p>
      </section>

      <section>
        <h2>Data Sharing</h2>
        <p>We do not sell your personal information. We may share data with:</p>
        <ul>
          <li>
            <strong>Service providers:</strong> Companies that help us operate
            our service (hosting, email delivery, analytics)
          </li>
          <li>
            <strong>Legal requirements:</strong> When required by law or to
            protect our rights
          </li>
        </ul>
      </section>

      <section>
        <h2>Your Rights</h2>
        <p>You have the right to:</p>
        <ul>
          <li>Access your personal data</li>
          <li>Correct inaccurate data</li>
          <li>Delete your account and data</li>
          <li>Export your data</li>
          <li>Opt out of marketing communications</li>
        </ul>
      </section>

      <section>
        <h2>Cookies</h2>
        <p>
          We use essential cookies to maintain your session and preferences. We
          also use analytics cookies to understand how our service is used. You
          can control cookie settings in your browser.
        </p>
      </section>

      <section>
        <h2>Security</h2>
        <p>
          We implement industry-standard security measures to protect your data,
          including encryption in transit and at rest, secure authentication,
          and regular security audits.
        </p>
      </section>

      <section>
        <h2>Changes to This Policy</h2>
        <p>
          We may update this privacy policy from time to time. We will notify
          you of significant changes by email or through our service.
        </p>
      </section>

      <section>
        <h2>Contact Us</h2>
        <p>
          If you have questions about this privacy policy or your data, please
          contact us at{" "}
          <a href="mailto:privacy@domainstack.io">privacy@domainstack.io</a>.
        </p>
      </section>

      <footer className="mt-12 border-border/50 border-t pt-8 text-sm">
        <p>
          See also our <Link href="/terms">Terms of Service</Link>.
        </p>
      </footer>
    </>
  );
}
