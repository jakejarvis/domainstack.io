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

type VerificationRevokedEmailProps = {
  userName: string;
  domainName: string;
};

export function VerificationRevokedEmail({
  userName,
  domainName,
}: VerificationRevokedEmailProps) {
  const previewText = `Verification for ${domainName} has been revoked`;

  return (
    <EmailLayout previewText={previewText}>
      <EmailHeading>❌ Verification Revoked</EmailHeading>

      <EmailText>Hi {userName},</EmailText>

      <EmailText>
        We&apos;ve removed <strong>{domainName}</strong> from your tracked
        domains because we couldn&apos;t verify your ownership after multiple
        attempts over the past week.
      </EmailText>

      <EmailBox variant="info">
        <EmailBoxText variant="info">
          <strong>What this means:</strong> You will no longer receive
          expiration alerts for this domain. Your domain data has not been
          deleted.
        </EmailBoxText>
      </EmailBox>

      <EmailText>
        If you still own this domain, you can re-add it to your dashboard and
        complete the verification process again.
      </EmailText>

      <EmailButton href={`${BASE_URL}/dashboard`}>Re-add Domain</EmailButton>

      <EmailHr />

      <EmailFooter>
        You received this email because you were tracking {domainName} on{" "}
        <EmailLink href="https://domainstack.io">Domainstack</EmailLink>. You
        can manage your notification settings in your{" "}
        <EmailLink href={`${BASE_URL}/settings`}>dashboard</EmailLink>.
      </EmailFooter>
    </EmailLayout>
  );
}

// Preview props for email development
VerificationRevokedEmail.PreviewProps = {
  userName: "Jake",
  domainName: "example.com",
} as VerificationRevokedEmailProps;

export default VerificationRevokedEmail;
