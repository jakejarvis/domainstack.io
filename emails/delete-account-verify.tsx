import { EmailBox, EmailBoxText } from "@/components/email/email-box";
import { EmailButton } from "@/components/email/email-button";
import { EmailLayout } from "@/components/email/email-layout";
import {
  EmailFooter,
  EmailHeading,
  EmailHr,
  EmailLink,
  EmailMutedText,
  EmailText,
} from "@/components/email/email-shared";

type DeleteAccountVerifyEmailProps = {
  userName: string;
  confirmUrl: string;
};

function DeleteAccountVerifyEmail({
  userName,
  confirmUrl,
}: DeleteAccountVerifyEmailProps) {
  const previewText = "Confirm your account deletion request";

  return (
    <EmailLayout previewText={previewText}>
      <EmailHeading>⚠️ Confirm Account Deletion</EmailHeading>

      <EmailText>Hi {userName},</EmailText>

      <EmailText>
        We received a request to permanently delete your Domainstack account.
        This action is <strong>irreversible</strong>.
      </EmailText>

      <EmailBox variant="danger">
        <EmailBoxText variant="danger" strong>
          What will be deleted:
        </EmailBoxText>
        <EmailBoxText variant="danger">• All your tracked domains</EmailBoxText>
        <EmailBoxText variant="danger">• Notification preferences</EmailBoxText>
        <EmailBoxText variant="danger">• Subscription data</EmailBoxText>
        <EmailBoxText variant="danger">• Account information</EmailBoxText>
      </EmailBox>

      <EmailText>
        If you did not request this, you can safely ignore this email. Your
        account will remain active.
      </EmailText>

      <EmailText>To proceed with deletion, click the button below:</EmailText>

      <EmailButton variant="danger" href={confirmUrl}>
        Delete My Account
      </EmailButton>

      <EmailMutedText>
        This link will expire in 1 hour for security purposes.
      </EmailMutedText>

      <EmailHr />

      <EmailFooter>
        You received this email because a deletion request was made for your{" "}
        <EmailLink href="https://domainstack.io">Domainstack</EmailLink>{" "}
        account. If you didn&apos;t make this request, please secure your
        account.
      </EmailFooter>
    </EmailLayout>
  );
}

// Preview props for email development
DeleteAccountVerifyEmail.PreviewProps = {
  userName: "Jake",
  confirmUrl: "https://domainstack.io/api/auth/delete-user?token=abc123",
} as DeleteAccountVerifyEmailProps;

export default DeleteAccountVerifyEmail;
