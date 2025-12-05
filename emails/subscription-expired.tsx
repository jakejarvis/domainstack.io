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

type SubscriptionExpiredEmailProps = {
  userName: string;
  archivedCount: number;
  dashboardUrl: string;
};

export function SubscriptionExpiredEmail({
  userName,
  archivedCount,
  dashboardUrl,
}: SubscriptionExpiredEmailProps) {
  const previewText = "Your Pro subscription has ended";

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Pro Subscription Ended</Heading>

          <Text style={text}>Hi {userName},</Text>

          <Text style={text}>
            Your <strong>Domainstack Pro</strong> subscription has ended and
            your account has been switched to the free tier.
          </Text>

          {archivedCount > 0 && (
            <Section style={boxWrapper}>
              <Section style={infoBox}>
                <Text style={infoText}>
                  <strong>
                    {archivedCount} domain
                    {archivedCount === 1 ? " was" : "s were"} archived
                  </strong>{" "}
                  to fit within the free tier limit. Don&apos;t worry — your
                  domains and their data are safe. You can view them in the
                  Archived tab on your dashboard.
                </Text>
              </Section>
            </Section>
          )}

          <Text style={text}>
            You can continue using Domainstack with the free tier, which
            includes tracking up to 5 domains.
          </Text>

          <Text style={text}>
            Miss Pro? You can resubscribe anytime to unlock all your domains and
            get back to tracking up to 50 domains.
          </Text>

          <Section style={buttonContainer}>
            <Button style={button} href={`${dashboardUrl}/settings`}>
              Resubscribe to Pro
            </Button>
          </Section>

          <Section style={secondaryButtonContainer}>
            <Button style={secondaryButton} href={dashboardUrl}>
              View Dashboard
            </Button>
          </Section>

          <Hr style={hr} />

          <Text style={footer}>
            You received this email because your Pro subscription ended on{" "}
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
SubscriptionExpiredEmail.PreviewProps = {
  userName: "Jake",
  archivedCount: 12,
  dashboardUrl: "https://domainstack.io/dashboard",
} as SubscriptionExpiredEmailProps;

export default SubscriptionExpiredEmail;

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
  backgroundColor: "#f3f4f6",
  borderRadius: "8px",
  padding: "14px 16px",
  borderLeft: "4px solid #6b7280",
};

const infoText = {
  color: "#374151",
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
  backgroundColor: "#10b981",
  borderRadius: "8px",
  color: "#fff",
  fontSize: "14px",
  fontWeight: "600",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "14px 32px",
};

const secondaryButtonContainer = {
  padding: "0 40px",
  marginTop: "12px",
  textAlign: "center" as const,
};

const secondaryButton = {
  backgroundColor: "transparent",
  borderRadius: "8px",
  border: "1px solid #d1d5db",
  color: "#374151",
  fontSize: "14px",
  fontWeight: "600",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "13px 32px",
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
