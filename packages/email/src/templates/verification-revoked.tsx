import {
  EmailBox,
  EmailBoxText,
  EmailButton,
  EmailFooter,
  EmailHeading,
  EmailHr,
  EmailLayout,
  EmailLink,
  EmailText,
} from "../components";

export type VerificationRevokedEmailProps = {
  userName: string;
  domainName: string;
  baseUrl: string;
};

function VerificationRevokedEmail({
  userName,
  domainName,
  baseUrl,
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

      <EmailButton href={`${baseUrl}/dashboard`}>Re-add Domain</EmailButton>

      <EmailHr />

      <EmailFooter>
        You received this email because you were tracking {domainName} on{" "}
        <EmailLink href="https://domainstack.io">Domainstack</EmailLink>. You
        can manage your notification settings in your{" "}
        <EmailLink href={`${baseUrl}/settings`}>dashboard</EmailLink>.
      </EmailFooter>
    </EmailLayout>
  );
}

// Preview props for email development
VerificationRevokedEmail.PreviewProps = {
  userName: "Jake",
  domainName: "example.com",
  baseUrl: "https://domainstack.io",
} as VerificationRevokedEmailProps;

export default VerificationRevokedEmail;
