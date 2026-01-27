import { EmailLayout } from "@/components/email/email-layout";
import {
  EmailCodeText,
  EmailFieldLabel,
  EmailFooter,
  EmailHeading,
  EmailHr,
  EmailLink,
  EmailNoteText,
  EmailSection,
  EmailSubheading,
  EmailText,
} from "@/components/email/email-shared";

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

function VerificationInstructionsEmail({
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

  return (
    <EmailLayout previewText={previewText}>
      <EmailHeading>Domain Verification Instructions</EmailHeading>

      <EmailText>
        {senderName} ({senderEmail}) has requested help verifying ownership of{" "}
        <strong>{domain}</strong> on Domainstack.
      </EmailText>

      <EmailText>
        Please complete <strong>ONE</strong> of the following verification
        methods:
      </EmailText>

      <EmailHr />

      {/* Option 1: DNS */}
      <EmailSection variant="option">
        <EmailSubheading>
          Option 1: DNS TXT Record (Recommended)
        </EmailSubheading>
        <EmailText>
          Add a TXT record to the domain&apos;s DNS settings:
        </EmailText>
        <EmailSection variant="code">
          <EmailFieldLabel>Host / Name</EmailFieldLabel>
          <EmailCodeText>@ ({dnsHostname})</EmailCodeText>
          <EmailFieldLabel>Type</EmailFieldLabel>
          <EmailCodeText>{dnsRecordType}</EmailCodeText>
          <EmailFieldLabel>Value / Content</EmailFieldLabel>
          <EmailCodeText>{dnsValue}</EmailCodeText>
          <EmailFieldLabel>TTL (recommended)</EmailFieldLabel>
          <EmailCodeText>
            {dnsTTL} ({dnsTTLLabel})
          </EmailCodeText>
        </EmailSection>
        <EmailNoteText>
          Note: DNS changes may take up to 48&nbsp;hours to propagate.
        </EmailNoteText>
      </EmailSection>

      <EmailHr />

      {/* Option 2: HTML File */}
      <EmailSection variant="option">
        <EmailSubheading>Option 2: HTML File Upload</EmailSubheading>
        <EmailText>Upload a file to the website:</EmailText>
        <EmailSection variant="code">
          <EmailFieldLabel>File Path</EmailFieldLabel>
          <EmailCodeText>{htmlFilePath}</EmailCodeText>
          <EmailFieldLabel>File Name</EmailFieldLabel>
          <EmailCodeText>{htmlFileName}</EmailCodeText>
          <EmailFieldLabel>File Contents</EmailFieldLabel>
          <EmailCodeText>{htmlFileContent}</EmailCodeText>
        </EmailSection>
        <EmailNoteText>
          The file must be accessible at: https://{domain}
          {htmlFilePath}
        </EmailNoteText>
      </EmailSection>

      <EmailHr />

      {/* Option 3: Meta Tag */}
      <EmailSection variant="option">
        <EmailSubheading>Option 3: Meta Tag</EmailSubheading>
        <EmailText>
          Add this meta tag to the homepage&apos;s {"<head>"} section:
        </EmailText>
        <EmailSection variant="code">
          <EmailCodeText>{metaTag}</EmailCodeText>
        </EmailSection>
      </EmailSection>

      <EmailHr />

      <EmailText>
        Once completed, {senderName} can return to{" "}
        <EmailLink href={`${process.env.NEXT_PUBLIC_BASE_URL}/dashboard`}>
          Domainstack
        </EmailLink>{" "}
        to verify ownership.
      </EmailText>

      <EmailHr />

      <EmailFooter>
        This email was sent on behalf of {senderName} via{" "}
        <EmailLink href="https://domainstack.io">Domainstack</EmailLink>. If you
        didn&apos;t expect this email, you can safely ignore it.
      </EmailFooter>
    </EmailLayout>
  );
}

// Preview props for email development
VerificationInstructionsEmail.PreviewProps = {
  domain: "example.com",
  senderName: "Jake",
  senderEmail: "jake@example.com",
  dnsHostname: "@",
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
