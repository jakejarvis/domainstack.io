import { IconExternalLink } from "@tabler/icons-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Learn how Domainstack collects, uses, and protects your personal information.",
};

export default function PrivacyPage() {
  return (
    <>
      <header className="not-prose">
        <h1 className="text-2xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Last updated: May 15, 2026
        </p>
      </header>

      <section id="introduction">
        <h2>Introduction</h2>
        <p>
          Domainstack ("we," "our," or "us") respects your privacy and is committed to protecting
          your personal data. This privacy policy explains how we collect, use, and safeguard your
          information when you use our domain intelligence platform, whether through our website or
          our iOS and Android mobile apps.
        </p>
      </section>

      <section id="information-we-collect">
        <h2>Information We Collect</h2>

        <h3>Account Information</h3>
        <p>
          When you create an account, we collect the following details from the sign-in provider you
          choose (such as GitHub, GitLab, Google, Vercel, or Apple):
        </p>
        <ul>
          <li>Name</li>
          <li>Email address (with verification status)</li>
          <li>Profile picture (optional)</li>
        </ul>
        <p>
          On our mobile apps you can sign in natively with Apple or Google. If you use{" "}
          <strong>Sign in with Apple</strong> and choose to hide your email, Apple provides us with
          a private relay email address instead of your personal address; we use this relay address
          to communicate with you and to send notifications.
        </p>

        <h3>Domain Data</h3>
        <p>
          When you use our service, we collect and display the following publicly available
          information:
        </p>
        <ul>
          <li>Domain registration and WHOIS information</li>
          <li>DNS records</li>
          <li>SSL/TLS certificate information</li>
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

        <h3>Mobile App Data</h3>
        <p>
          When you use our iOS or Android app, we additionally collect and store the following so we
          can deliver push notifications and support the app:
        </p>
        <ul>
          <li>
            A push notification token issued by Apple or Google (via the Expo push service) for each
            device on which you enable notifications
          </li>
          <li>The device platform (iOS or Android), device name, and app version</li>
        </ul>
        <p>
          Your authentication session is stored securely on the device using the platform&apos;s
          encrypted credential storage (iOS Keychain / Android Keystore). We do not collect
          advertising identifiers, and the app does not track you across other apps or websites.
        </p>
      </section>

      <section id="how-we-use-your-information">
        <h2>How We Use Your Information</h2>
        <p>We use your information to:</p>
        <ul>
          <li>Provide and maintain our service</li>
          <li>Send domain and certificate expiration notifications by email</li>
          <li>
            Deliver push notifications to your mobile devices, if you use our app and grant
            notification permission
          </li>
          <li>Improve and personalize your experience</li>
          <li>Communicate important updates about our service</li>
          <li>Detect and prevent fraud or abuse</li>
        </ul>
      </section>

      <section id="data-retention">
        <h2>Data Retention</h2>
        <p>
          We retain your account information for as long as your account is active. Domain data is
          cached temporarily to improve performance and is refreshed periodically.
        </p>
        <p>
          You can delete your account at any time through the self-service option in your dashboard
          settings. Account deletion is permanent and will remove all your personal data, tracked
          domains, notification preferences, and subscription information from our systems.
        </p>
      </section>

      <section id="payment-information">
        <h2>Payment Information</h2>
        <p>
          When you subscribe to our Pro plan, payment processing is handled by our third-party
          partners:
        </p>
        <ul>
          <li>
            <strong>
              <a href="https://polar.sh" target="_blank" rel="noopener noreferrer">
                Polar
                <IconExternalLink />
              </a>
            </strong>{" "}
            : Our merchant of record for subscription management. Polar collects and processes your
            payment information, including billing address and payment method. See{" "}
            <a href="https://polar.sh/legal/privacy" target="_blank" rel="noopener noreferrer">
              Polar&apos;s Privacy Policy
              <IconExternalLink />
            </a>
            .
          </li>
          <li>
            <strong>
              <a href="https://stripe.com" target="_blank" rel="noopener noreferrer">
                Stripe
                <IconExternalLink />
              </a>
            </strong>{" "}
            : Payment processing infrastructure. Stripe handles your payment card data securely. See{" "}
            <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer">
              Stripe&apos;s Privacy Policy
              <IconExternalLink />
            </a>
            .
          </li>
        </ul>
        <p>
          We do not store your full payment card details. We receive only limited information from
          our payment partners, such as subscription status, billing email, and the last four digits
          of your card for display purposes.
        </p>
      </section>

      <section id="email-communications">
        <h2>Email Communications</h2>
        <p>
          We use{" "}
          <a href="https://resend.com" target="_blank" rel="noopener noreferrer">
            Resend
            <IconExternalLink />
          </a>{" "}
          to send transactional emails, including:
        </p>
        <ul>
          <li>Domain and certificate expiration alerts</li>
          <li>Domain verification status notifications</li>
          <li>Subscription and account-related emails</li>
          <li>Account deletion confirmation emails</li>
        </ul>
        <p>
          When we send you an email, your email address is shared with Resend for delivery purposes.
          See{" "}
          <a
            href="https://resend.com/legal/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Resend&apos;s Privacy Policy
            <IconExternalLink />
          </a>
          .
        </p>
      </section>

      <section id="push-notifications">
        <h2>Push Notifications</h2>
        <p>
          If you use our mobile app and grant notification permission, we send push notifications
          for the same events covered by email (domain and certificate expiration, change detection,
          and verification status). To deliver these, the notification content and your
          device&apos;s push token are processed by:
        </p>
        <ul>
          <li>
            <strong>
              <a href="https://expo.dev" target="_blank" rel="noopener noreferrer">
                Expo
                <IconExternalLink />
              </a>
            </strong>{" "}
            : Relays notifications from our servers to Apple and Google. See{" "}
            <a href="https://expo.dev/privacy" target="_blank" rel="noopener noreferrer">
              Expo&apos;s Privacy Policy
              <IconExternalLink />
            </a>
            .
          </li>
          <li>
            <strong>Apple Push Notification service</strong> (for iOS devices) and{" "}
            <strong>Firebase Cloud Messaging</strong> (for Android devices), operated by Apple and
            Google respectively, which transmit the notification to your device.
          </li>
        </ul>
        <p>
          You can turn push notifications off at any time from your device settings or from within
          the app, and you can manage which notification categories you receive in your account
          settings.
        </p>
      </section>

      <section id="ai-assistant">
        <h2>AI Assistant</h2>
        <p>
          We offer an optional AI-powered chat assistant ("Stacky") to help you look up domain
          information using natural language.
        </p>

        <h3>How It Works</h3>
        <p>
          The AI assistant is powered by{" "}
          <a href="https://vercel.com/docs/ai-gateway" target="_blank" rel="noopener noreferrer">
            Vercel AI Gateway
            <IconExternalLink />
          </a>
          , which routes Domainstack&apos;s requests to large language model (LLM) providers. When
          you send a message:
        </p>
        <ul>
          <li>
            Your message and recent conversation history (up to 10 messages) are sent to the AI
            service
          </li>
          <li>The domain you&apos;re currently viewing may be included as context</li>
          <li>The AI may use our domain lookup tools to fetch publicly available information</li>
        </ul>

        <h3>Conversation Storage</h3>
        <p>We do not store your conversations on our servers. This means:</p>
        <ul>
          <li>Conversations are private to your device and browser</li>
          <li>Clearing your browser data will delete your chat history</li>
          <li>Conversations do not sync across devices or browsers</li>
          <li>You can clear your chat history at any time using the clear button</li>
        </ul>

        <h3>Data Shared with AI Providers</h3>
        <p>
          When you use the AI assistant, your messages are processed by third-party AI providers
          through Vercel AI Gateway. These providers have their own privacy policies:
        </p>
        <ul>
          <li>
            <a
              href="https://openai.com/policies/privacy-policy/"
              target="_blank"
              rel="noopener noreferrer"
            >
              OpenAI Privacy Policy
              <IconExternalLink />
            </a>{" "}
            (for OpenAI models)
          </li>
          <li>
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
              Google Privacy Policy
              <IconExternalLink />
            </a>{" "}
            (for Gemini models)
          </li>
          <li>
            <a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener noreferrer">
              Anthropic Privacy Policy
              <IconExternalLink />
            </a>{" "}
            (for Claude models)
          </li>
          <li>
            <a
              href="https://vercel.com/legal/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
            >
              Vercel Privacy Policy
              <IconExternalLink />
            </a>
          </li>
        </ul>
        <p>
          We do not share your personal account information with AI providers. Messages are
          processed without your identity attached.
        </p>
        <p>The provider(s) used to process your conversations will vary.</p>
      </section>

      <section id="analytics">
        <h2>Analytics</h2>
        <p>
          We use{" "}
          <a href="https://posthog.com" target="_blank" rel="noopener noreferrer">
            PostHog
            <IconExternalLink />
          </a>{" "}
          for product analytics and error tracking to understand how our service is used and to
          improve the user experience. PostHog collects:
        </p>
        <ul>
          <li>Pages viewed and features used</li>
          <li>Device and browser information</li>
          <li>IP address (used for approximate location, then discarded)</li>
          <li>Error reports and performance metrics</li>
        </ul>
        <p>
          Analytics data is used in aggregate to improve our service and is not sold to third
          parties. See{" "}
          <a href="https://posthog.com/privacy" target="_blank" rel="noopener noreferrer">
            PostHog&apos;s Privacy Policy
            <IconExternalLink />
          </a>
          .
        </p>
        <p>
          PostHog is also used in our mobile app to capture basic app-lifecycle and usage events.
          Session replay is disabled, and the app does not autocapture errors. In the app you can
          turn analytics and error reporting on or off at any time from the privacy controls in
          Settings.
        </p>
      </section>

      <section id="data-sharing">
        <h2>Data Sharing</h2>
        <p>We do not sell your personal information. We may share data with:</p>
        <ul>
          <li>
            <strong>Service providers:</strong> Companies that help us operate our service (hosting)
          </li>
          <li>
            <strong>Analytics:</strong> PostHog for product analytics (see Analytics section above)
          </li>
          <li>
            <strong>Email delivery:</strong> Resend for transactional email (see Email
            Communications section above)
          </li>
          <li>
            <strong>Push notifications:</strong> Expo, Apple, and Google to deliver mobile push
            notifications (see Push Notifications section above)
          </li>
          <li>
            <strong>Authentication providers:</strong> The sign-in provider you choose (GitHub,
            GitLab, Google, Vercel, or Apple) to verify your identity
          </li>
          <li>
            <strong>Payment processors:</strong> Polar and Stripe for subscription billing (see
            Payment Information section above)
          </li>
          <li>
            <strong>Legal requirements:</strong> When required by law or to protect our rights
          </li>
        </ul>
      </section>

      <section id="your-rights">
        <h2>Your Rights</h2>
        <p>You have the right to:</p>
        <ul>
          <li>Access your personal data</li>
          <li>Correct inaccurate data</li>
          <li>
            Delete your account and data: You can permanently delete your account at any time from
            your dashboard settings. This will remove all your personal data, tracked domains, and
            notification preferences. If you have an active subscription, it will be automatically
            canceled.
          </li>
          <li>Export your data</li>
          <li>Opt out of marketing communications</li>
        </ul>
      </section>

      <section id="cookies">
        <h2>Cookies</h2>
        <p>
          We use cookies to provide and improve our service. Our approach to cookies depends on your
          location:
        </p>

        <h3>For EU/EEA Visitors</h3>
        <p>
          If you visit from a country covered by GDPR (EU member states, EEA countries, and the UK),
          you&apos;ll see a cookie consent banner on your first visit. You can choose to:
        </p>
        <ul>
          <li>
            <strong>Accept:</strong> We&apos;ll use analytics cookies to understand how you use our
            service and improve your experience.
          </li>
          <li>
            <strong>Decline:</strong> We&apos;ll switch to cookieless tracking mode, collecting only
            anonymized usage data without storing any cookies on your device.
          </li>
        </ul>

        <h3>For Visitors Outside the EU/EEA</h3>
        <p>
          If you visit from outside the EU/EEA, analytics cookies are enabled by default to provide
          the best experience. You can still opt out using your browser&apos;s built-in cookie
          controls.
        </p>

        <h3>Types of Cookies We Use</h3>
        <ul>
          <li>
            <strong>Essential cookies:</strong> Required for basic functionality like authentication
            and session management. These are always active regardless of your consent choice.
          </li>
          <li>
            <strong>Analytics cookies:</strong> Used by PostHog to understand how you use our
            service, track errors, and improve the user experience. For EU/EEA visitors, these
            require your consent.
          </li>
        </ul>

        <h3>Changing Your Preferences</h3>
        <p>
          To change your cookie preferences, you can clear your browser&apos;s cookies and local
          storage for this site, then revisit to see the consent banner again (EU/EEA visitors
          only).
        </p>

        <h3>Mobile App</h3>
        <p>
          Our mobile apps do not use cookies. They store a small amount of data locally on your
          device (such as your authentication session and app preferences) to keep you signed in and
          remember your settings. Instead of a cookie banner, the app provides in-app controls in
          Settings to turn analytics and error reporting on or off.
        </p>
      </section>

      <section id="security">
        <h2>Security</h2>
        <p>
          We implement industry-standard security measures to protect your data, including
          encryption in transit and at rest, secure authentication, and regular security audits. On
          our mobile apps, your authentication session is stored in the device&apos;s
          hardware-backed encrypted storage (iOS Keychain / Android Keystore).
        </p>
      </section>

      <section id="changes-to-this-policy">
        <h2>Changes to This Policy</h2>
        <p>
          We may update this privacy policy from time to time. We will notify you of significant
          changes by email or through our service.
        </p>
      </section>

      <section id="contact-us">
        <h2>Contact Us</h2>
        <p>
          If you have questions about this privacy policy or your data, please contact us at{" "}
          <a href="mailto:privacy@domainstack.io">privacy@domainstack.io</a>.
        </p>
      </section>
    </>
  );
}
