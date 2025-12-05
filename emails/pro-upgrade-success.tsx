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

type ProUpgradeSuccessEmailProps = {
  userName: string;
  dashboardUrl: string;
};

export function ProUpgradeSuccessEmail({
  userName,
  dashboardUrl,
}: ProUpgradeSuccessEmailProps) {
  const previewText = "Welcome to Domainstack Pro!";

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>🎉 Welcome to Pro!</Heading>

          <Text style={text}>Hi {userName},</Text>

          <Text style={text}>
            Thank you for upgrading to <strong>Domainstack Pro</strong>! Your
            payment has been confirmed and your account has been upgraded.
          </Text>

          <Section style={boxWrapper}>
            <Section style={successBox}>
              <Text style={successText}>
                <strong>Your Pro benefits are now active:</strong>
              </Text>
              <Text style={benefitItem}>• Track up to 50 domains</Text>
              <Text style={benefitItem}>• Priority email notifications</Text>
              <Text style={benefitItem}>• Support ongoing development</Text>
            </Section>
          </Section>

          <Text style={text}>
            Head to your dashboard to start tracking more domains and customize
            your notification preferences.
          </Text>

          <Section style={buttonContainer}>
            <Button style={button} href={dashboardUrl}>
              Go to Dashboard
            </Button>
          </Section>

          <Hr style={hr} />

          <Text style={footer}>
            You received this email because you upgraded to Pro on{" "}
            <Link href="https://domainstack.io" style={link}>
              Domainstack
            </Link>
            . Manage your subscription in your{" "}
            <Link href={`${dashboardUrl}/settings`} style={link}>
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
ProUpgradeSuccessEmail.PreviewProps = {
  userName: "Jake",
  dashboardUrl: "https://domainstack.io/dashboard",
} as ProUpgradeSuccessEmailProps;

export default ProUpgradeSuccessEmail;

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

const successBox = {
  backgroundColor: "#ecfdf5",
  borderRadius: "8px",
  padding: "14px 16px",
  borderLeft: "4px solid #10b981",
};

const successText = {
  color: "#065f46",
  fontSize: "14px",
  lineHeight: "1.5",
  margin: "0 0 8px",
  padding: "0",
};

const benefitItem = {
  color: "#065f46",
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
