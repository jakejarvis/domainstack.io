import { EmailBox, EmailBoxText } from "@/components/email/email-box";
import { EmailButton } from "@/components/email/email-button";
import { EmailLayout } from "@/components/email/email-layout";
import {
  EmailFooter,
  EmailHeading,
  EmailHr,
  EmailLink,
  EmailSubheading,
  EmailText,
} from "@/components/email/email-shared";
import { BASE_URL } from "@/lib/constants/app";

type ProviderChangeEmailProps = {
  userName: string;
  domainName: string;
  changes: {
    dnsProviderChanged: boolean;
    hostingProviderChanged: boolean;
    emailProviderChanged: boolean;
    previousDnsProvider?: string | null;
    newDnsProvider?: string | null;
    previousHostingProvider?: string | null;
    newHostingProvider?: string | null;
    previousEmailProvider?: string | null;
    newEmailProvider?: string | null;
  };
};

export function ProviderChangeEmail({
  userName,
  domainName,
  changes,
}: ProviderChangeEmailProps) {
  const previewText = `Provider changes detected for ${domainName}`;

  const changeCount =
    (changes.dnsProviderChanged ? 1 : 0) +
    (changes.hostingProviderChanged ? 1 : 0) +
    (changes.emailProviderChanged ? 1 : 0);

  return (
    <EmailLayout previewText={previewText}>
      <EmailHeading>🔄 Provider Change Detected</EmailHeading>

      <EmailText>Hi {userName},</EmailText>

      <EmailText>
        We detected {changeCount === 1 ? "a change" : `${changeCount} changes`}{" "}
        to the service providers for <strong>{domainName}</strong>.
      </EmailText>

      {changes.dnsProviderChanged && (
        <>
          <EmailSubheading>DNS Provider Changed</EmailSubheading>
          <EmailBox variant="info">
            <EmailBoxText variant="info">
              <strong>Previous:</strong>{" "}
              {changes.previousDnsProvider || "Unknown"}
              <br />
              <strong>New:</strong> {changes.newDnsProvider || "Unknown"}
            </EmailBoxText>
          </EmailBox>
        </>
      )}

      {changes.hostingProviderChanged && (
        <>
          <EmailSubheading>Hosting Provider Changed</EmailSubheading>
          <EmailBox variant="info">
            <EmailBoxText variant="info">
              <strong>Previous:</strong>{" "}
              {changes.previousHostingProvider || "Unknown"}
              <br />
              <strong>New:</strong> {changes.newHostingProvider || "Unknown"}
            </EmailBoxText>
          </EmailBox>
        </>
      )}

      {changes.emailProviderChanged && (
        <>
          <EmailSubheading>Email Provider Changed</EmailSubheading>
          <EmailBox variant="info">
            <EmailBoxText variant="info">
              <strong>Previous:</strong>{" "}
              {changes.previousEmailProvider || "Unknown"}
              <br />
              <strong>New:</strong> {changes.newEmailProvider || "Unknown"}
            </EmailBoxText>
          </EmailBox>
        </>
      )}

      <EmailBox variant="warning">
        <EmailBoxText variant="warning">
          <strong>Verify this change:</strong> Make sure this change was
          intentional. If you didn&apos;t migrate to a new provider, your DNS
          records may have been tampered with.
        </EmailBoxText>
      </EmailBox>

      <EmailButton href={`${BASE_URL}/${domainName}`}>
        View Domain Details
      </EmailButton>

      <EmailHr />

      <EmailFooter>
        You received this email because you&apos;re tracking {domainName} on{" "}
        <EmailLink href="https://domainstack.io">Domainstack</EmailLink>. You
        can manage your notification settings in your{" "}
        <EmailLink href={`${BASE_URL}/settings`}>dashboard</EmailLink>.
      </EmailFooter>
    </EmailLayout>
  );
}

// Preview props for email development
ProviderChangeEmail.PreviewProps = {
  userName: "Jake",
  domainName: "example.com",
  changes: {
    dnsProviderChanged: true,
    hostingProviderChanged: false,
    emailProviderChanged: true,
    previousDnsProvider: "Cloudflare",
    newDnsProvider: "Amazon Route 53",
    previousEmailProvider: "Google Workspace",
    newEmailProvider: "Microsoft 365",
  },
} as ProviderChangeEmailProps;

export default ProviderChangeEmail;
