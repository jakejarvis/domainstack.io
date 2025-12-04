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
import type { VerificationMethod } from "@/lib/db/repos/tracked-domains";

type VerificationFailingEmailProps = {
  userName: string;
  domainName: string;
  verificationMethod: VerificationMethod;
  gracePeriodDays: number;
  dashboardUrl: string;
};

const METHOD_DESCRIPTIONS: Record<VerificationMethod, string> = {
  dns_txt: "DNS TXT record",
  html_file: "HTML verification file",
  meta_tag: "meta tag",
};

export function VerificationFailingEmail({
  userName,
  domainName,
  verificationMethod,
  gracePeriodDays,
  dashboardUrl,
}: VerificationFailingEmailProps) {
  const methodDescription = METHOD_DESCRIPTIONS[verificationMethod];
  const previewText = `We couldn't verify your ownership of ${domainName}`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>⚠️ Verification Failing</Heading>

          <Text style={text}>Hi {userName},</Text>

          <Text style={text}>
            We couldn&apos;t verify your ownership of{" "}
            <strong>{domainName}</strong> during our daily check. The{" "}
            {methodDescription} we&apos;re looking for appears to be missing or
            incorrect.
          </Text>

          <Section style={boxWrapper}>
            <Section style={warningBox}>
              <Text style={warningText}>
                <strong>Action Required:</strong> You have{" "}
                <strong>{gracePeriodDays} days</strong> to restore verification
                before your domain is removed from tracking.
              </Text>
            </Section>
          </Section>

          <Text style={text}>
            Please check that your {methodDescription} is still in place. If you
            intentionally removed it, you can re-verify ownership from your
            dashboard.
          </Text>

          <Section style={buttonContainer}>
            <Button style={button} href={dashboardUrl}>
              View Dashboard
            </Button>
          </Section>

          <Hr style={hr} />

          <Text style={footer}>
            You received this email because you&apos;re tracking {domainName} on{" "}
            <Link href="https://domainstack.io" style={link}>
              Domainstack
            </Link>
            . You can manage your notification settings in your{" "}
            <Link href={`${dashboardUrl}/settings`} style={link}>
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
VerificationFailingEmail.PreviewProps = {
  userName: "Jake",
  domainName: "example.com",
  verificationMethod: "dns_txt",
  gracePeriodDays: 7,
  dashboardUrl: "https://domainstack.io/dashboard",
} as VerificationFailingEmailProps;

export default VerificationFailingEmail;

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

const warningBox = {
  backgroundColor: "#fffbeb",
  borderRadius: "8px",
  padding: "14px 16px",
  borderLeft: "4px solid #f59e0b",
};

const warningText = {
  color: "#92400e",
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
