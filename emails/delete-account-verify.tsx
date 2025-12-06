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

type DeleteAccountVerifyEmailProps = {
  userName: string;
  confirmUrl: string;
};

export function DeleteAccountVerifyEmail({
  userName,
  confirmUrl,
}: DeleteAccountVerifyEmailProps) {
  const previewText = "Confirm your account deletion request";

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>⚠️ Confirm Account Deletion</Heading>

          <Text style={text}>Hi {userName},</Text>

          <Text style={text}>
            We received a request to permanently delete your Domainstack
            account. This action is <strong>irreversible</strong>.
          </Text>

          <Section style={boxWrapper}>
            <Section style={warningBox}>
              <Text style={warningTitle}>What will be deleted:</Text>
              <Text style={warningText}>• All your tracked domains</Text>
              <Text style={warningText}>• Notification preferences</Text>
              <Text style={warningText}>• Subscription data</Text>
              <Text style={warningText}>• Account information</Text>
            </Section>
          </Section>

          <Text style={text}>
            If you did not request this, you can safely ignore this email. Your
            account will remain active.
          </Text>

          <Text style={text}>
            To proceed with deletion, click the button below:
          </Text>

          <Section style={buttonContainer}>
            <Button style={button} href={confirmUrl}>
              Delete My Account
            </Button>
          </Section>

          <Text style={mutedText}>
            This link will expire in 1 hour for security purposes.
          </Text>

          <Hr style={hr} />

          <Text style={footer}>
            You received this email because a deletion request was made for your{" "}
            <Link href="https://domainstack.io" style={link}>
              Domainstack
            </Link>{" "}
            account. If you didn&apos;t make this request, please secure your
            account.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

// Preview props for email development
DeleteAccountVerifyEmail.PreviewProps = {
  userName: "Jake",
  confirmUrl: "https://domainstack.io/api/auth/delete-user?token=abc123",
} as DeleteAccountVerifyEmailProps;

export default DeleteAccountVerifyEmail;

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

const mutedText = {
  color: "#6b7280",
  fontSize: "13px",
  lineHeight: "1.5",
  margin: "16px 0 0",
  padding: "0 40px",
  textAlign: "center" as const,
};

const boxWrapper = {
  padding: "8px 40px 20px",
};

const warningBox = {
  backgroundColor: "#fef2f2",
  borderRadius: "8px",
  padding: "14px 16px",
  borderLeft: "4px solid #dc2626",
};

const warningTitle = {
  color: "#991b1b",
  fontSize: "14px",
  fontWeight: "600",
  lineHeight: "1.5",
  margin: "0 0 8px",
  padding: "0",
};

const warningText = {
  color: "#7f1d1d",
  fontSize: "14px",
  lineHeight: "1.5",
  margin: "0 0 4px",
  padding: "0",
};

const buttonContainer = {
  padding: "0 40px",
  marginTop: "28px",
  textAlign: "center" as const,
};

const button = {
  backgroundColor: "#dc2626",
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
