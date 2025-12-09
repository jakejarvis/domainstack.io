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

type CertificateExpiryEmailProps = {
  userName: string;
  domainName: string;
  expirationDate: string;
  daysRemaining: number;
  issuer: string;
};

export function CertificateExpiryEmail({
  userName,
  domainName,
  expirationDate,
  daysRemaining,
  issuer,
}: CertificateExpiryEmailProps) {
  const isUrgent = daysRemaining <= 3;
  const previewText = `SSL certificate for ${domainName} expires in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>
            {isUrgent ? "🔒⚠️ " : "🔒 "}Certificate Expiration Alert
          </Heading>

          <Text style={text}>Hi {userName},</Text>

          <Text style={text}>
            The SSL certificate for <strong>{domainName}</strong> is set to
            expire{" "}
            {daysRemaining === 1 ? (
              <span style={urgent}>tomorrow</span>
            ) : (
              <>
                in{" "}
                <span style={isUrgent ? urgent : highlight}>
                  {daysRemaining} days
                </span>
              </>
            )}{" "}
            on <strong>{expirationDate}</strong>.
          </Text>

          <Section style={boxWrapper}>
            <Section style={infoBox}>
              <Text style={infoText}>
                <strong>Certificate Issuer:</strong> {issuer}
              </Text>
            </Section>
          </Section>

          {isUrgent && (
            <Section style={boxWrapper}>
              <Section style={warningBox}>
                <Text style={warningText}>
                  <strong>Action Required:</strong> Renew your SSL certificate
                  immediately to avoid browser security warnings and potential
                  service interruption.
                </Text>
              </Section>
            </Section>
          )}

          <Text style={text}>
            {issuer.toLowerCase().includes("let's encrypt") ? (
              <>
                Let&apos;s Encrypt certificates typically auto-renew. If this
                one hasn&apos;t, check your server&apos;s renewal configuration
                or contact your hosting provider.
              </>
            ) : (
              <>
                Contact your certificate authority or hosting provider to renew
                the certificate before it expires.
              </>
            )}
          </Text>

          <Section style={buttonContainer}>
            <Button style={button} href={`${BASE_URL}/dashboard`}>
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
CertificateExpiryEmail.PreviewProps = {
  userName: "Jake",
  domainName: "example.com",
  expirationDate: "January 15, 2025",
  daysRemaining: 7,
  issuer: "Let's Encrypt",
} as CertificateExpiryEmailProps;

export default CertificateExpiryEmail;

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

const highlight = {
  color: "#ea580c",
  fontWeight: "600",
};

const urgent = {
  color: "#dc2626",
  fontWeight: "700",
};

const boxWrapper = {
  padding: "8px 40px 20px",
};

const infoBox = {
  backgroundColor: "#f0f9ff",
  borderRadius: "8px",
  padding: "14px 16px",
  borderLeft: "4px solid #0ea5e9",
};

const infoText = {
  color: "#0369a1",
  fontSize: "14px",
  lineHeight: "1.5",
  margin: "0",
  padding: "0",
};

const warningBox = {
  backgroundColor: "#fef2f2",
  borderRadius: "8px",
  padding: "14px 16px",
  borderLeft: "4px solid #dc2626",
};

const warningText = {
  color: "#991b1b",
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
