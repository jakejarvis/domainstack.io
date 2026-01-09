import { EmailBox, EmailBoxText } from "@/components/email/email-box";
import { EmailButton } from "@/components/email/email-button";
import { EmailLayout } from "@/components/email/email-layout";
import {
  EmailFooter,
  EmailHeading,
  EmailHr,
  EmailLink,
  EmailText,
} from "@/components/email/email-shared";
import { BASE_URL } from "@/lib/constants/app";

type CertificateExpiryEmailProps = {
  userName: string;
  domainName: string;
  expirationDate: string;
  daysRemaining: number;
  issuer: string;
};

function CertificateExpiryEmail({
  userName,
  domainName,
  expirationDate,
  daysRemaining,
  issuer,
}: CertificateExpiryEmailProps) {
  const isUrgent = daysRemaining <= 3;
  const previewText = `SSL certificate for ${domainName} expires in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`;

  return (
    <EmailLayout previewText={previewText}>
      <EmailHeading>
        {isUrgent ? "🔒⚠️ " : "🔒 "}Certificate Expiration Alert
      </EmailHeading>

      <EmailText>Hi {userName},</EmailText>

      <EmailText>
        The SSL certificate for <strong>{domainName}</strong> is set to expire{" "}
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
      </EmailText>

      <EmailBox variant="info">
        <EmailBoxText variant="info">
          <strong>Certificate Issuer:</strong> {issuer}
        </EmailBoxText>
      </EmailBox>

      {isUrgent && (
        <EmailBox variant="danger">
          <EmailBoxText variant="danger">
            <strong>Action Required:</strong> Renew your SSL certificate
            immediately to avoid browser security warnings and potential service
            interruption.
          </EmailBoxText>
        </EmailBox>
      )}

      <EmailText>
        {issuer.toLowerCase().includes("let's encrypt") ? (
          <>
            Let&apos;s Encrypt certificates typically auto-renew. If this one
            hasn&apos;t, check your server&apos;s renewal configuration or
            contact your hosting provider.
          </>
        ) : (
          <>
            Contact your certificate authority or hosting provider to renew the
            certificate before it expires.
          </>
        )}
      </EmailText>

      <EmailButton href={`${BASE_URL}/dashboard`}>View Dashboard</EmailButton>

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
CertificateExpiryEmail.PreviewProps = {
  userName: "Jake",
  domainName: "example.com",
  expirationDate: "January 15, 2025",
  daysRemaining: 7,
  issuer: "Let's Encrypt",
} as CertificateExpiryEmailProps;

export default CertificateExpiryEmail;

// Template-specific styles
const highlight = {
  color: "#ea580c",
  fontWeight: "600",
};

const urgent = {
  color: "#dc2626",
  fontWeight: "700",
};
