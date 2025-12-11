import {
  Body,
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

type VerificationInstructionsEmailProps = {
  domain: string;
  senderName: string;
  senderEmail: string;
  dnsHostname: string;
  dnsRecordType: string;
  dnsValue: string;
  dnsTTL: number;
  dnsTTLLabel: string;
  htmlFilePath: string;
  htmlFileName: string;
  htmlFileContent: string;
  metaTag: string;
};

export function VerificationInstructionsEmail({
  domain,
  senderName,
  senderEmail,
  dnsHostname,
  dnsRecordType,
  dnsValue,
  dnsTTL,
  dnsTTLLabel,
  htmlFilePath,
  htmlFileName,
  htmlFileContent,
  metaTag,
}: VerificationInstructionsEmailProps) {
  const previewText = `Domain verification instructions for ${domain}`;

  // Extract the prefix from hostname (e.g., "_domainstack-verify" from "_domainstack-verify.example.com")
  const dotIndex = dnsHostname.indexOf(".");
  const dnsHostnamePrefix =
    dotIndex > 0 ? dnsHostname.slice(0, dotIndex) : dnsHostname;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Domain Verification Instructions</Heading>

          <Text style={text}>
            {senderName} ({senderEmail}) has requested help verifying ownership
            of <strong>{domain}</strong> on Domainstack.
          </Text>

          <Text style={text}>
            Please complete <strong>ONE</strong> of the following verification
            methods:
          </Text>

          <Hr style={hr} />

          {/* Option 1: DNS */}
          <Section style={optionSection}>
            <Heading as="h2" style={h2}>
              Option 1: DNS TXT Record (Recommended)
            </Heading>
            <Text style={text}>
              Add a TXT record to the domain&apos;s DNS settings:
            </Text>
            <Section style={codeSection}>
              <Text style={fieldLabel}>Host / Name</Text>
              <Text style={codeText}>{dnsHostnamePrefix}</Text>
              <Text style={fieldLabel}>Type</Text>
              <Text style={codeText}>{dnsRecordType}</Text>
              <Text style={fieldLabel}>Value / Content</Text>
              <Text style={codeText}>{dnsValue}</Text>
              <Text style={fieldLabel}>TTL (recommended)</Text>
              <Text style={codeText}>
                {dnsTTL} ({dnsTTLLabel})
              </Text>
            </Section>
            <Text style={noteText}>
              Note: DNS changes may take up to 48 hours to propagate.
            </Text>
          </Section>

          <Hr style={hr} />

          {/* Option 2: HTML File */}
          <Section style={optionSection}>
            <Heading as="h2" style={h2}>
              Option 2: HTML File Upload
            </Heading>
            <Text style={text}>Upload a file to the website:</Text>
            <Section style={codeSection}>
              <Text style={fieldLabel}>File Path</Text>
              <Text style={codeText}>{htmlFilePath}</Text>
              <Text style={fieldLabel}>File Name</Text>
              <Text style={codeText}>{htmlFileName}</Text>
              <Text style={fieldLabel}>File Contents</Text>
              <Text style={codeText}>{htmlFileContent}</Text>
            </Section>
            <Text style={noteText}>
              The file must be accessible at: https://{domain}
              {htmlFilePath}
            </Text>
          </Section>

          <Hr style={hr} />

          {/* Option 3: Meta Tag */}
          <Section style={optionSection}>
            <Heading as="h2" style={h2}>
              Option 3: Meta Tag
            </Heading>
            <Text style={text}>
              Add this meta tag to the homepage&apos;s {"<head>"} section:
            </Text>
            <Section style={codeSection}>
              <Text style={codeText}>{metaTag}</Text>
            </Section>
          </Section>

          <Hr style={hr} />

          <Text style={text}>
            Once completed, {senderName} can return to{" "}
            <Link href={`${BASE_URL}/dashboard`} style={link}>
              Domainstack
            </Link>{" "}
            to verify ownership.
          </Text>

          <Hr style={hr} />

          <Text style={footer}>
            This email was sent on behalf of {senderName} via{" "}
            <Link href="https://domainstack.io" style={link}>
              Domainstack
            </Link>
            . If you didn&apos;t expect this email, you can safely ignore it.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

// Preview props for email development
VerificationInstructionsEmail.PreviewProps = {
  domain: "example.com",
  senderName: "Jake",
  senderEmail: "jake@example.com",
  dnsHostname: "_domainstack-verify.example.com",
  dnsRecordType: "TXT",
  dnsValue: "domainstack-verify=abc123xyz",
  dnsTTL: 300,
  dnsTTLLabel: "5 minutes",
  htmlFilePath: "/.well-known/domainstack-verify.html",
  htmlFileName: "domainstack-verify.html",
  htmlFileContent: "domainstack-verify=abc123xyz",
  metaTag: '<meta name="domainstack-verify" content="abc123xyz">',
} as VerificationInstructionsEmailProps;

export default VerificationInstructionsEmail;

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
  maxWidth: "600px",
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

const h2 = {
  color: "#1f2937",
  fontSize: "16px",
  fontWeight: "600",
  lineHeight: "1.4",
  margin: "0 0 12px",
  padding: "0 40px",
};

const text = {
  color: "#374151",
  fontSize: "15px",
  lineHeight: "1.65",
  margin: "0 0 16px",
  padding: "0 40px",
};

const noteText = {
  color: "#6b7280",
  fontSize: "13px",
  fontStyle: "italic" as const,
  lineHeight: "1.5",
  margin: "12px 0 0",
  padding: "0 40px",
};

const optionSection = {
  margin: "0",
  padding: "0",
};

const codeSection = {
  padding: "0 40px",
};

const fieldLabel = {
  color: "#6b7280",
  fontSize: "12px",
  fontWeight: "500",
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  margin: "12px 0 4px",
  padding: "0",
};

const codeText = {
  backgroundColor: "#f3f4f6",
  borderRadius: "6px",
  color: "#1f2937",
  fontFamily: 'Menlo, Monaco, "Courier New", monospace',
  fontSize: "13px",
  lineHeight: "1.5",
  margin: "0 0 8px",
  padding: "10px 12px",
  wordBreak: "break-all" as const,
};

const hr = {
  borderColor: "#e5e7eb",
  margin: "24px 40px",
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
