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

type VerificationRevokedEmailProps = {
  userName: string;
  domainName: string;
};

export function VerificationRevokedEmail({
  userName,
  domainName,
}: VerificationRevokedEmailProps) {
  const previewText = `Verification for ${domainName} has been revoked`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>❌ Verification Revoked</Heading>

          <Text style={text}>Hi {userName},</Text>

          <Text style={text}>
            We&apos;ve removed <strong>{domainName}</strong> from your tracked
            domains because we couldn&apos;t verify your ownership after
            multiple attempts over the past week.
          </Text>

          <Section style={boxWrapper}>
            <Section style={infoBox}>
              <Text style={infoText}>
                <strong>What this means:</strong> You will no longer receive
                expiration alerts for this domain. Your domain data has not been
                deleted.
              </Text>
            </Section>
          </Section>

          <Text style={text}>
            If you still own this domain, you can re-add it to your dashboard
            and complete the verification process again.
          </Text>

          <Section style={buttonContainer}>
            <Button style={button} href={`${BASE_URL}/dashboard`}>
              Re-add Domain
            </Button>
          </Section>

          <Hr style={hr} />

          <Text style={footer}>
            You received this email because you were tracking {domainName} on{" "}
            <Link href="https://domainstack.io" style={link}>
              Domainstack
            </Link>
            . You can manage your notification settings in your{" "}
            <Link href={`${BASE_URL}/settings`} style={link}>
              dashboard
            </Link>
            .
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

// Preview props for email development
VerificationRevokedEmail.PreviewProps = {
  userName: "Jake",
  domainName: "example.com",
} as VerificationRevokedEmailProps;

export default VerificationRevokedEmail;

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
