import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { BASE_URL } from "@/lib/constants/app";

type ProWelcomeEmailProps = {
  userName: string;
  proMaxDomains: number;
};

export function ProWelcomeEmail({
  userName,
  proMaxDomains,
}: ProWelcomeEmailProps) {
  const previewText = "Get the most out of Domainstack Pro";

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Getting Started with Pro</Heading>

          <Text style={text}>Hi {userName},</Text>

          <Text style={text}>
            Thanks again for joining Domainstack Pro! Here are a few tips to
            help you get the most out of your subscription.
          </Text>

          <Section style={boxWrapper}>
            <Section style={tipBox}>
              <Text style={tipTitle}>1. Add Your Domains</Text>
              <Text style={tipText}>
                You can now track up to {proMaxDomains} domains. Add them from
                your dashboard and verify ownership to start receiving alerts.
              </Text>
            </Section>
          </Section>

          <Section style={boxWrapper}>
            <Section style={tipBox}>
              <Text style={tipTitle}>2. Set Up Notifications</Text>
              <Text style={tipText}>
                Customize when you receive alerts for domain expiration, SSL
                certificate expiry, and verification status changes.
              </Text>
            </Section>
          </Section>

          <Section style={boxWrapper}>
            <Section style={tipBox}>
              <Text style={tipTitle}>3. Stay Organized</Text>
              <Text style={tipText}>
                Archive domains you&apos;re not actively monitoring. They
                won&apos;t count against your limit and you can restore them
                anytime.
              </Text>
            </Section>
          </Section>

          <Text style={text}>
            Have questions or feedback? Just reply to this email — we&apos;d
            love to hear from you.
          </Text>

          <Section style={buttonContainer}>
            <Button style={button} href={`${BASE_URL}/dashboard`}>
              Open Dashboard
            </Button>
          </Section>

          <Hr style={hr} />

          <Text style={footer}>
            You received this email because you upgraded to Pro on{" "}
            <Link href="https://domainstack.io" style={link}>
              Domainstack
            </Link>
            . Manage your subscription in your{" "}
            <Link href={`${BASE_URL}/settings`} style={link}>
              account settings
            </Link>
            .
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

// Preview props for email development
ProWelcomeEmail.PreviewProps = {
  userName: "Jake",
  proMaxDomains: 50,
} as ProWelcomeEmailProps;

export default ProWelcomeEmail;

// Styles
const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
  padding: "40px 0",
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "32px 0 40px",
  borderRadius: "12px",
  maxWidth: "560px",
  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
};

const h1 = {
  color: "#1f2937",
  fontSize: "22px",
  fontWeight: "600",
  lineHeight: "1.4",
  margin: "0 0 24px",
  padding: "0 40px",
};

const text = {
  color: "#374151",
  fontSize: "15px",
  lineHeight: "1.65",
  margin: "0 0 16px",
  padding: "0 40px",
};

const boxWrapper = {
  padding: "4px 40px 12px",
};

const tipBox = {
  backgroundColor: "#f0f9ff",
  borderRadius: "8px",
  padding: "14px 16px",
  borderLeft: "4px solid #0ea5e9",
};

const tipTitle = {
  color: "#0369a1",
  fontSize: "14px",
  fontWeight: "600",
  lineHeight: "1.4",
  margin: "0 0 6px",
  padding: "0",
};

const tipText = {
  color: "#0c4a6e",
  fontSize: "14px",
  lineHeight: "1.5",
  margin: "0",
  padding: "0",
};

const buttonContainer = {
  padding: "0 40px",
  marginTop: "28px",
  textAlign: "center" as const,
};

const button = {
  backgroundColor: "#0f172a",
  borderRadius: "8px",
  color: "#fff",
  fontSize: "14px",
  fontWeight: "600",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "14px 32px",
};

const hr = {
  borderColor: "#e5e7eb",
  margin: "32px 40px",
};

const footer = {
  color: "#6b7280",
  fontSize: "12px",
  lineHeight: "1.6",
  margin: "0",
  padding: "0 40px",
};

const link = {
  color: "#2563eb",
  textDecoration: "underline",
};
