import {
  EmailButton,
  EmailFooter,
  EmailHeading,
  EmailHr,
  EmailLayout,
  EmailLink,
  EmailMutedText,
  EmailText,
} from "../components";

export type ConfirmEmailChangeEmailProps = {
  userName: string;
  newEmail: string;
  confirmUrl: string;
  baseUrl: string;
};

function ConfirmEmailChangeEmail({
  userName,
  newEmail,
  confirmUrl,
  baseUrl,
}: ConfirmEmailChangeEmailProps) {
  const previewText = "Confirm your new Domainstack email address";

  return (
    <EmailLayout previewText={previewText}>
      <EmailHeading>Confirm Your New Email Address</EmailHeading>

      <EmailText>Hi {userName},</EmailText>

      <EmailText>
        You asked to move your Domainstack account to <strong>{newEmail}</strong>. Alerts and
        account emails will go here once you confirm.
      </EmailText>

      <EmailButton variant="primary" href={confirmUrl}>
        Confirm New Email
      </EmailButton>

      <EmailMutedText>
        This link expires in 1&nbsp;hour. Open it in the browser where you&apos;re signed in to
        Domainstack.
      </EmailMutedText>

      <EmailHr />

      <EmailFooter>
        If you didn&apos;t ask for this, ignore this email. Your{" "}
        <EmailLink href={baseUrl}>Domainstack</EmailLink> account stays as it is.
      </EmailFooter>
    </EmailLayout>
  );
}

// Preview props for email development
ConfirmEmailChangeEmail.PreviewProps = {
  userName: "Jake",
  newEmail: "jake@example.com",
  confirmUrl: "https://domainstack.io/api/auth/verify-email?token=abc123",
  baseUrl: "https://domainstack.io",
};

export default ConfirmEmailChangeEmail;
