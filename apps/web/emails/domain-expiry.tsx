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

type DomainExpiryEmailProps = {
  userName: string;
  domainName: string;
  expirationDate: string;
  daysRemaining: number;
  registrar?: string;
};

function DomainExpiryEmail({
  userName,
  domainName,
  expirationDate,
  daysRemaining,
  registrar,
}: DomainExpiryEmailProps) {
  const isUrgent = daysRemaining <= 7;
  const previewText = `${domainName} expires in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`;

  return (
    <EmailLayout previewText={previewText}>
      <EmailHeading>{isUrgent ? "⚠️ " : ""}Domain Expiration Alert</EmailHeading>

      <EmailText>Hi {userName},</EmailText>

      <EmailText>
        Your domain <strong>{domainName}</strong> is set to expire{" "}
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

      {registrar && (
        <EmailBox variant="info">
          <EmailBoxText variant="info">
            <strong>Registrar:</strong> {registrar}
          </EmailBoxText>
        </EmailBox>
      )}

      {isUrgent && (
        <EmailBox variant="danger">
          <EmailBoxText variant="danger">
            <strong>Action Required:</strong> Renew your domain immediately to
            avoid service interruption.
          </EmailBoxText>
        </EmailBox>
      )}

      <EmailText>
        To prevent losing ownership of this domain, make sure to renew it with{" "}
        {registrar ? registrar : "your registrar"} before it expires.
      </EmailText>

      <EmailButton href={`${process.env.NEXT_PUBLIC_BASE_URL}/dashboard`}>
        View Dashboard
      </EmailButton>

      <EmailHr />

      <EmailFooter>
        You received this email because you&apos;re tracking {domainName} on{" "}
        <EmailLink href="https://domainstack.io">Domainstack</EmailLink>. You
        can manage your notification settings in your{" "}
        <EmailLink href={`${process.env.NEXT_PUBLIC_BASE_URL}/settings`}>
          dashboard
        </EmailLink>
        .
      </EmailFooter>
    </EmailLayout>
  );
}

// Preview props for email development
DomainExpiryEmail.PreviewProps = {
  userName: "Jake",
  domainName: "example.com",
  expirationDate: "January 15, 2025",
  daysRemaining: 7,
  registrar: "Cloudflare",
} as DomainExpiryEmailProps;

export default DomainExpiryEmail;

// Template-specific styles
const highlight = {
  color: "#ea580c",
  fontWeight: "600",
};

const urgent = {
  color: "#dc2626",
  fontWeight: "700",
};
