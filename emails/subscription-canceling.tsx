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

type SubscriptionCancelingEmailProps = {
  userName: string;
  endDate: string;
  dashboardUrl: string;
};

export function SubscriptionCancelingEmail({
  userName,
  endDate,
  dashboardUrl,
}: SubscriptionCancelingEmailProps) {
  const previewText = `Your Pro subscription ends on ${endDate}`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Subscription Canceled</Heading>

          <Text style={text}>Hi {userName},</Text>

          <Text style={text}>
            We&apos;ve received your cancellation request. Your{" "}
            <strong>Domainstack Pro</strong> subscription will remain active
            until <strong>{endDate}</strong>.
          </Text>

          <Section style={boxWrapper}>
            <Section style={infoBox}>
              <Text style={infoText}>
                <strong>What happens next:</strong>
              </Text>
              <Text style={infoItem}>
                • You&apos;ll keep full Pro access until {endDate}
              </Text>
              <Text style={infoItem}>
                • After that, your account will switch to the free tier
              </Text>
              <Text style={infoItem}>
                • Domains beyond the free limit will be archived (not deleted)
              </Text>
            </Section>
          </Section>

          <Text style={text}>
            Changed your mind? You can resubscribe anytime before {endDate} to
            keep your Pro benefits without interruption.
          </Text>

          <Section style={buttonContainer}>
            <Button style={button} href={`${dashboardUrl}/settings`}>
              Manage Subscription
            </Button>
          </Section>

          <Hr style={hr} />

          <Text style={footer}>
            You received this email because you canceled your Pro subscription
            on{" "}
            <Link href="https://domainstack.io" style={link}>
              Domainstack
            </Link>
            . If you have any questions, just reply to this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

// Preview props for email development
SubscriptionCancelingEmail.PreviewProps = {
  userName: "Jake",
  endDate: "January 15, 2025",
  dashboardUrl: "https://domainstack.io/dashboard",
} as SubscriptionCancelingEmailProps;

export default SubscriptionCancelingEmail;

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
  padding: "8px 40px 20px",
};

const infoBox = {
  backgroundColor: "#fffbeb",
  borderRadius: "8px",
  padding: "14px 16px",
  borderLeft: "4px solid #f59e0b",
};

const infoText = {
  color: "#92400e",
  fontSize: "14px",
  lineHeight: "1.5",
  margin: "0 0 8px",
  padding: "0",
};

const infoItem = {
  color: "#92400e",
  fontSize: "14px",
  lineHeight: "1.6",
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
