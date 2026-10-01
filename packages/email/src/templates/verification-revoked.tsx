import {
  EmailBox,
  EmailBoxText,
  EmailButton,
  EmailHeading,
  EmailHr,
  EmailLayout,
  EmailText,
  TrackingEmailFooter,
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
        We couldn&apos;t verify your ownership of <strong>{domainName}</strong> after multiple
        attempts over the past week, so it&apos;s now marked as unverified.
      </EmailText>

      <EmailBox variant="info">
        <EmailBoxText variant="info">
          <strong>What this means:</strong> You won&apos;t receive alerts for this domain until
          it&apos;s verified again. It&apos;s still on your dashboard and none of its data has been
          deleted.
        </EmailBoxText>
      </EmailBox>

      <EmailText>If you still own this domain, open your dashboard and verify it again.</EmailText>

      <EmailButton href={`${baseUrl}/dashboard`}>Verify Domain</EmailButton>

      <EmailHr />

      <TrackingEmailFooter domainName={domainName} baseUrl={baseUrl} wasTracking />
    </EmailLayout>
  );
}

// Preview props for email development
VerificationRevokedEmail.PreviewProps = {
  userName: "Jake",
  domainName: "example.com",
  baseUrl: "https://domainstack.io",
};

export default VerificationRevokedEmail;
