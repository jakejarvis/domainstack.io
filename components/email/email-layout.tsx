import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Preview,
} from "@react-email/components";
import { RESEND_LOGO_CONTENT_ID } from "@/lib/constants/email";

type EmailLayoutProps = {
  previewText: string;
  children: React.ReactNode;
};

export function EmailLayout({ previewText, children }: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <div style={logoContainer}>
            <Img
              src={`cid:${RESEND_LOGO_CONTENT_ID}`}
              alt="Domainstack"
              style={logo}
            />
          </div>
          {children}
        </Container>
      </Body>
    </Html>
  );
}

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

const logoContainer = {
  textAlign: "center" as const,
  padding: "0 40px",
  marginBottom: "24px",
};

const logo = {
  height: "48px",
  width: "auto",
  display: "inline-block",
};
