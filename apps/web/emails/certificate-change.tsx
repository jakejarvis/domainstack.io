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

type CertificateChangeEmailProps = {
  userName: string;
  domainName: string;
  changes: {
    caProviderChanged: boolean;
    issuerChanged: boolean;
    previousCaProvider?: string | null;
    newCaProvider?: string | null;
    previousIssuer?: string | null;
    newIssuer?: string | null;
  };
  newValidTo?: string; // ISO date string
};

function CertificateChangeEmail({
  userName,
  domainName,
  changes,
  newValidTo,
}: CertificateChangeEmailProps) {
  const previewText = `Certificate changes detected for ${domainName}`;

  // Determine if this is likely a renewal based on issuer staying the same
  const likelyRenewal = !changes.caProviderChanged && !changes.issuerChanged;

  return (
    <EmailLayout previewText={previewText}>
      <EmailHeading>
        🔒 Certificate {likelyRenewal ? "Renewed" : "Changed"}
      </EmailHeading>

      <EmailText>Hi {userName},</EmailText>

      <EmailText>
        {likelyRenewal ? (
          <>
            The SSL certificate for <strong>{domainName}</strong> has been
            renewed.
          </>
        ) : (
          <>
            We detected changes to the SSL certificate for{" "}
            <strong>{domainName}</strong>.
          </>
        )}
      </EmailText>

      {changes.caProviderChanged && (
        <>
          <EmailSubheading>Certificate Authority Changed</EmailSubheading>
          <EmailBox variant="info">
            <EmailBoxText variant="info">
              <strong>Previous CA:</strong>{" "}
              {changes.previousCaProvider || "Unknown"}
              <br />
              <strong>New CA:</strong> {changes.newCaProvider || "Unknown"}
            </EmailBoxText>
          </EmailBox>
        </>
      )}

      {changes.issuerChanged && (
        <>
          <EmailSubheading>Issuer Changed</EmailSubheading>
          <EmailBox variant="info">
            <EmailBoxText variant="info">
              <strong>Previous Issuer:</strong>{" "}
              {changes.previousIssuer || "Unknown"}
              <br />
              <strong>New Issuer:</strong> {changes.newIssuer || "Unknown"}
            </EmailBoxText>
          </EmailBox>
        </>
      )}

      {newValidTo && (
        <EmailBox variant="success">
          <EmailBoxText variant="success">
            <strong>New Expiration:</strong>{" "}
            {new Date(newValidTo).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </EmailBoxText>
        </EmailBox>
      )}

      {!likelyRenewal && (
        <EmailBox variant="warning">
          <EmailBoxText variant="warning">
            <strong>Verify this change:</strong> Certificate changes should only
            occur during renewals or migrations. If you didn&apos;t expect this,
            verify that your domain&apos;s SSL configuration is correct.
          </EmailBoxText>
        </EmailBox>
      )}

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
CertificateChangeEmail.PreviewProps = {
  userName: "Jake",
  domainName: "example.com",
  changes: {
    caProviderChanged: true,
    issuerChanged: true,
    previousCaProvider: "Let's Encrypt",
    newCaProvider: "DigiCert",
    previousIssuer: "R3",
    newIssuer: "DigiCert TLS RSA SHA256 2020 CA1",
  },
  newValidTo: "2025-12-15T00:00:00Z",
} as CertificateChangeEmailProps;

export default CertificateChangeEmail;
